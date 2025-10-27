# Cloudflare Worker: Proxy para API de Datos Abiertos de Navarra

Motivo: El runtime de Railway (US-West Metal Edge) no puede establecer conexiones HTTPS hacia `https://datosabiertos.navarra.es/` por restricciones de red/firewall. Como workaround, usamos un Worker de Cloudflare (red global con presencia en Europa) que hace el fetch por nosotros y devuelve la respuesta en streaming al backend.

Esta solución evita migrar de host y mantiene el backend Express tal cual, cambiando solo el destino de las peticiones de Navarra para que pasen por el Worker.

### Limitaciones y notas
- Este proxy es solo de lectura (GET). Si necesitas POST/PUT, amplíalo con validación adicional.
- CORS: no es necesario para backend→Worker (server-to-server). Si llamas desde navegador, añade `Access-Control-Allow-Origin`.
- Tamaño/streaming: Cloudflare Workers soporta streaming de respuestas. Aun así, respuestas extremadamente grandes pueden estar limitadas por el producto/plan. Para CKAN paginado (<= 1000 registros/página), es seguro.
- CPU/Timeout: Workers tienen límites de CPU por request. El fetch y streaming no consume mucho CPU. Usa paginación en CKAN como ya haces.
- Seguridad: Se incluye whitelist de hosts para evitar abuso. Amplíala si necesitas más orígenes.

## Despliegue rápido (UI de Cloudflare)
1. Entra a https://dash.cloudflare.com/ → Workers & Pages → Create → Worker.
2. Elige «Start from scratch», asigna un nombre (p. ej., `navarra-proxy`).
3. Opciones:
  - Pega el contenido de `cloudflare/navarra-proxy/src/index.js` y despliega.
  - O usa el botón “Upload from GitHub” apuntando a esta carpeta.
4. Copia la URL pública, por ejemplo: `https://navarra-proxy.<tu-subdominio>.workers.dev`.

Opcional (CLI) con Wrangler:
- Instala Wrangler si no lo tienes: `npm i -g wrangler`
- Entra en `cloudflare/navarra-proxy/` y ejecuta: `wrangler deploy`

## Configuración en el backend
- Añade una variable de entorno en Railway: `NAVARRA_PROXY_BASE=https://navarra-proxy.<tu-subdominio>.workers.dev`
- El servicio `navarra.service.js` usará esa URL y le pasará el `?url=` del destino.

## Causa original y workaround
- Causa: Conectividad desde Railway US-West hacia `datosabiertos.navarra.es` bloqueada (timeouts ETIMEDOUT por firewall/routing entre regiones).
- Workaround: El Worker de Cloudflare actúa como relay/proxy en Europa, con conectividad directa al origen, y devuelve la respuesta al backend.
