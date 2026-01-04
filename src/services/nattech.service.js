import fetch from 'node-fetch';

const BASE_URL = process.env.NATTECH_API_URL;
const TOKEN = process.env.NATTECH_API_TOKEN;
const ECO_TAG = process.env.NATTECH_ECO_TAG;

const getHeaders = () => ({
  Authorization: TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json',
});

const mapToExternalFormat = (data) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return undefined;
    try {
      // Si ja ve com a YYYY-MM-DD, el deixem
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }
      const dateObj = new Date(dateStr);
      // toISOString() -> "2025-12-01T10:00:00.000Z" -> agafem els primers 10
      return dateObj.toISOString().substring(0, 10);
    } catch (e) {
      console.warn('[NatTech] Error formatejant data:', dateStr);
      return dateStr; // Retornem tal qual si falla
    }
  };

  const nom = data.name || data.nom;
  const descripcio = data.description || data.descripcio;
  const data_inici = formatDate(data.startDate || data.data_inici);
  const data_fi = formatDate(data.endDate || data.data_fi);
  const localitat = data.address || data.localitat || data.adreca;
  const latitud = data.lat || data.latitud;
  const longitud = data.lon || data.longitud;

  let fotos_urls = [];
  if (data.image) fotos_urls = [data.image];
  else if (data.fotos_urls) fotos_urls = data.fotos_urls;

  const { name, description, startDate, endDate, address, lat, lon, image, tags, ...rest } = data;

  // devolver objeto mapeado
  return {
    ...rest, // Altres camps que no coneixem
    nom, // Obligatori
    descripcio, // Obligatori
    data_inici, // Obligatori (YYYY-MM-DD)
    data_fi, // Obligatori (YYYY-MM-DD)
    localitat,
    latitud,
    longitud,
    fotos_urls,
  };
};

/**
 * GET /api/events
 * Obtiene todos los eventos (filtrados automáticamente por el tag de EcoMap)
 */
export const getExternalEvents = async (params = {}) => {
  const url = new URL(`${BASE_URL}/events`);

  // añadir parámetros excepto 'tags'
  Object.keys(params).forEach((key) => {
    if (key !== 'tags') {
      url.searchParams.append(key, params[key]);
    }
  });

  // forzar el tag siempre
  url.searchParams.append('tags', ECO_TAG);

  console.log(`[NatTech] GET ${url.toString()}`);

  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Error NatTech API: ${response.status} ${response.statusText}`);
  }
  return await response.json();
};

/**
 * GET /api/events/{codi}
 * Obtiene un evento en específico (siempre con el tag de EcoMap)
 */
export const getExternalEventByCodi = async (codi) => {
  const response = await fetch(`${BASE_URL}/events/${codi}`, { headers: getHeaders() });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Error NatTech API: ${response.status}`);
  }

  const event = await response.json();

  // verificar que el evento tenga el tag de EcoMap
  const eventTags = event.tags || '';
  if (!eventTags.includes(ECO_TAG)) {
    return null;
  }

  return event;
};

/**
 * POST /api/events
 * Crea un evento (obligatoriamente con el tag de EcoMap)
 */
export const createExternalEvent = async (eventData) => {
  const mappedData = mapToExternalFormat(eventData);

  const payload = {
    ...mappedData,
    // sobreescribir o añadir el tag
    tags: eventData.tags ? `${eventData.tags},${ECO_TAG}` : ECO_TAG,
  };

  console.log('[NatTech] Creating event payload:', JSON.stringify(payload));

  const response = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[NatTech] Error creating event:', errorBody);
    throw new Error(`NatTech API Error (${response.status}): ${errorBody}`);
  }
  return await response.json();
};

/**
 * PUT /api/events/{codi}
 * Actualiza un evento (sin poder editar el tag de EcoMap)
 */
export const updateExternalEvent = async (codi, eventData) => {
  const currentEvent = await getExternalEventByCodi(codi);
  if (!currentEvent) {
    throw new Error('Evento no encontrado o no pertenece a EcoMap');
  }

  const mappedData = mapToExternalFormat(eventData);

  const { tags, ...dataToUpdate } = mappedData;

  const payload = {
    ...dataToUpdate,
    tags: currentEvent.tags, // mantener los tags originales intactos
  };

  const response = await fetch(`${BASE_URL}/events/${codi}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error actualizando evento ${codi}: ${errorBody}`);
  }
  return await response.json();
};

/**
 * DELETE /api/events/{codi}
 * Borra un evento (solamente si tiene el tag de EcoMap)
 */
export const deleteExternalEvent = async (codi) => {
  const event = await getExternalEventByCodi(codi);

  if (!event) {
    throw new Error('Evento no encontrado o acceso denegado (Tag incorrecto)');
  }

  const response = await fetch(`${BASE_URL}/events/${codi}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Error eliminando evento ${codi}: ${response.statusText}`);
  }
  return true;
};
