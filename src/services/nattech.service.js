import fetch from 'node-fetch';

const BASE_URL = process.env.NATTECH_API_URL;
const TOKEN = process.env.NATTECH_API_TOKEN;

const getHeaders = () => ({
  Authorization: TOKEN,
  'Content-Type': 'application/json',
  accept: 'application/json',
});

/**
 * GET /api/events
 */
export const getExternalEvents = async (params = {}) => {
  // Convertir params a query string si es necesario
  const url = new URL(`${BASE_URL}/events`);
  Object.keys(params).forEach((key) => url.searchParams.append(key, params[key]));

  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Error NatTech API: ${response.status} ${response.statusText}`);
  }
  return await response.json();
};

/**
 * GET /api/events/{codi}
 */
export const getExternalEventByCodi = async (codi) => {
  const response = await fetch(`${BASE_URL}/events/${codi}`, { headers: getHeaders() });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Error NatTech API: ${response.status}`);
  }
  return await response.json();
};

/**
 * POST /api/events
 * Requisito: Tag "agenda:categories/EcoMap" hardcodeado.
 */
export const createExternalEvent = async (eventData) => {
  const fixedTag = 'agenda:categories/EcoMap';

  // Si tags es un array, añadimos el nuestro. Si es string, lo concatenamos o reemplazamos.
  // Basado en swagger usualmente es string o array. Asumiremos string separado por comas o array.
  // Para asegurar, lo mandamos como parte de los datos.

  const payload = {
    ...eventData,
    // Forzamos el tag. Si ya venían tags, los mantenemos y añadimos el nuestro.
    tags: eventData.tags ? `${eventData.tags},${fixedTag}` : fixedTag,
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
 */
export const updateExternalEvent = async (codi, eventData) => {
  const response = await fetch(`${BASE_URL}/events/${codi}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    throw new Error(`Error actualizando evento ${codi}: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * DELETE /api/events/{codi}
 */
export const deleteExternalEvent = async (codi) => {
  const response = await fetch(`${BASE_URL}/events/${codi}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Error eliminando evento ${codi}: ${response.statusText}`);
  }
  return true;
};
