import fetch from 'node-fetch';

export async function getRoute(start, end, profile = 'driving-car') {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw new Error('❌ Falta ORS_API_KEY en el .env');

  const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}`;
  const body = {
    coordinates: [
      [parseFloat(start.lng), parseFloat(start.lat)],
      [parseFloat(end.lng), parseFloat(end.lat)],
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('No se pudo parsear JSON de ORS');
  }

  // Compatibilidad v8 y v9
  const route = data.features?.[0] || data.routes?.[0];
  if (!route) {
    throw new Error('Respuesta inválida de ORS: ' + text);
  }

  // Distancia y duración
  const distance = route.summary?.distance || route.properties?.summary?.distance;
  const duration = route.summary?.duration || route.properties?.summary?.duration;

  // Geometría (decodificada si viene como string)
  let geometryCoords = [];
  if (route.geometry?.coordinates) {
    geometryCoords = route.geometry.coordinates;
  } else if (typeof route.geometry === 'string') {
    geometryCoords = decodePolyline(route.geometry);
  }

  // 🧭 Instrucciones paso a paso
  const steps = [];
  const segments = route.segments || route.properties?.segments;
  if (segments && segments.length > 0) {
    for (const step of segments[0].steps) {
      steps.push({
        distance: step.distance,
        duration: step.duration,
        instruction: step.instruction,
        name: step.name,
        type: step.type,
      });
    }
  }

  return {
    distance,
    duration,
    geometry: geometryCoords,
    steps, // 👈 Instrucciones detalladas
  };
}

/** Decodificador de polylines */
function decodePolyline(str, precision = 5) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift,
    result,
    byte,
    factor = Math.pow(10, precision);

  while (index < str.length) {
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const latitude_change = result & 1 ? ~(result >> 1) : result >> 1;

    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const longitude_change = result & 1 ? ~(result >> 1) : result >> 1;

    lat += latitude_change;
    lng += longitude_change;
    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}
