import fetch from 'node-fetch';

const BASE_URL = process.env.NATTECH_API_URL;
const TOKEN = process.env.NATTECH_API_TOKEN;
const ECO_TAG = process.env.NATTECH_ECO_TAG;

const getHeaders = () => ({
  Authorization: TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json',
});

/**
 * GET /api/events
 * Obtiene todos los eventos (filtrados automáticamente por el tag de EcoMap)
 */
export const getExternalEvents = async (params = {}) => {
  const url = new URL(`${BASE_URL}/events`);

  // añadir parámetros excepto 'tags'
  Object.key(params).forEach((key) => {
    if (key !== 'tags') {
      url.searchParams.append(key, params[key]);
    }
  });

  // forzar el tag siempre
  url.searchParams.append('tags', ECO_TAG);

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
  if (!event.tags || !event.tags.includes(ECO_TAG)) {
    return null; // devuelve 404 "Not found"
  }

  return event;
};

/**
 * POST /api/events
 * Crea un evento (obligatoriamente con el tag de EcoMap)
 */
export const createExternalEvent = async (eventData) => {
  const payload = {
    ...eventData,
    // sobreescribir o añadir el tag
    tags: eventData.tags ? `${eventData.tags},${ECO_TAG}` : ECO_TAG,
  };

  const response = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error creando evento en NatTech: ${errorBody}`);
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

  const { tags, ...dataToUpdate } = eventData;

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
    throw new Error(`Error actualizando evento ${codi}: ${response.statusText}`);
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
