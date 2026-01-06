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
  const formatDate = (dateInput) => {
    if (!dateInput) return undefined;
    try {
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }

      const dateStr = dateInput instanceof Date ? dateInput.toISOString() : dateInput;
      return dateStr.split('T')[0];
    } catch {
      console.warn('[NatTech] Error formatejant data:', dateInput);
      return dateInput;
    }
  };

  const nom = data.name || data.nom;
  const descripcio = data.description || data.descripcio;
  const data_inici = formatDate(data.startDate || data.data_inici);
  const data_fi = formatDate(data.endDate || data.data_fi);
  const localitat = data.address || data.localitat || data.adreca;
  const latitud = data.lat || data.latitud;
  const longitud = data.lon || data.longitud;
  const entrades = data.entrades;
  const horari = data.horari;

  let fotos_urls = [];
  if (data.image) fotos_urls = [data.image];
  else if (data.fotos_urls) fotos_urls = data.fotos_urls;

  // devolver objeto mapeado
  return {
    nom,
    descripcio,
    data_inici,
    data_fi,
    localitat,
    latitud,
    longitud,
    fotos_urls,
    codi: data.codi,
    id: data.id,
    entrades,
    horari,
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
  //url.searchParams.append('tags', ECO_TAG);

  console.log(`[NatTech] GET ${url.toString()}`);

  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Error NatTech API: ${response.status} ${response.statusText}`);
  }

  const events = await response.json();

  /*if (Array.isArray(events)) {
    return events.filter((event) => {
      const eventTags = event.tags || '';
      const tagsString = Array.isArray(eventTags) ? eventTags.join(',') : eventTags;

      return tagsString.includes(ECO_TAG);
    });
  }*/

  return events;
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

  const safeBase = mapToExternalFormat(currentEvent);

  const changes = mapToExternalFormat(eventData);

  const mergedData = { ...safeBase };

  Object.keys(changes).forEach((key) => {
    // Solo aplicamos el cambio si el usuario envió algo (no undefined)
    if (changes[key] !== undefined) {
      mergedData[key] = changes[key];
    }
  });

  const payload = {
    ...mergedData,
    tags: currentEvent.tags, // mantener los tags originales intactos
  };

  console.log('[NatTech] Update Payload:', JSON.stringify(payload));

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
