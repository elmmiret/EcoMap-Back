// Cloudflare Worker: Proxy de lectura para CKAN Navarra
// Causa original: Railway (US-West Metal Edge) tiene conectividad limitada hacia https://datosabiertos.navarra.es/
// lo que genera ETIMEDOUT. Este Worker actúa como relay/proxy (red Cloudflare con POPs en Europa)
// para realizar la petición y devolver la respuesta al backend en streaming.
// Limitaciones: solo GET; si se usa desde navegador, añade CORS; respuestas muy grandes pueden estar
// limitadas por plan del Worker; incluye whitelist de hosts para evitar abuso.

const ALLOWED_HOSTS = ['datosabiertos.navarra.es'];

const DEFAULT_TIMEOUT_MS = 20000; // 20s (puede ser sobrescrito vía ?timeout_ms)

export default {
  async fetch(request, _env, _ctx) {
    try {
      const url = new URL(request.url);
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'missing_url', message: 'Parámetro ?url requerido' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      let targetUrl;
      try {
        targetUrl = new URL(target);
      } catch {
        return new Response(JSON.stringify({ error: 'invalid_url', message: 'El parámetro ?url no es una URL válida' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
        return new Response(JSON.stringify({ error: 'forbidden_host', message: `Host no permitido: ${targetUrl.hostname}` }), {
          status: 403,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      // Permitir override opcional del timeout mediante query param timeout_ms (con límites)
      const timeoutParam = Number(url.searchParams.get('timeout_ms') || DEFAULT_TIMEOUT_MS);
      const timeoutMs = Math.min(Math.max(timeoutParam, 1000), 25000); // entre 1s y 25s

      const ac = new AbortController();
      const id = setTimeout(() => ac.abort('timeout'), timeoutMs);

      const upstream = await fetch(targetUrl.toString(), {
        method: 'GET',
        signal: ac.signal,
      }).finally(() => clearTimeout(id));

      // Copiar headers salvo hop-by-hop
      const hopByHop = new Set([
        'connection',
        'transfer-encoding',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
      ]);
      const headers = new Headers();
      upstream.headers.forEach((v, k) => {
        if (!hopByHop.has(k.toLowerCase())) headers.set(k, v);
      });

      // Para uso desde navegador, descomenta:
      // headers.set('access-control-allow-origin', '*');

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || err === 'timeout';
      return new Response(
        JSON.stringify({
          error: isAbort ? 'upstream_timeout' : 'proxy_error',
          message: isAbort ? 'Timeout al conectar con el origen' : err?.message || 'Fallo de proxy',
        }),
        {
          status: 502,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }
      );
    }
  },
};
