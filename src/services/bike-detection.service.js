/**
 * Bike Detection Service
 *
 * Integración con HuggingFace Spaces YOLO para detectar bicicletas en imágenes
 */

import { createLogger } from '#lib/logger.js';

const log = createLogger('bike-detection');

// URL del servicio externo de detección (nuevo endpoint base)
// Se asume que el punto de inferencia sigue siendo /infer; ajustar si cambia.
const HF_SPACES_URL = 'https://tacosrra-ecomap-ai.hf.space/bikes';

// Palabras clave que identifican una bicicleta en las detecciones YOLO
const BIKE_KEYWORDS = ['bicycle'];

/**
 * Detecta si hay una bicicleta en una imagen usando el modelo YOLO en HuggingFace Spaces
 *
 * @param {Buffer} imageBuffer - Buffer de la imagen a analizar
 * @param {string} mimeType - Tipo MIME de la imagen (ej: 'image/jpeg', 'image/png')
 * @returns {Promise<{hasBike: boolean, confidence: number|null, detections: Array, raw: object}>}
 */
export async function detectBike(imageBuffer, mimeType = 'image/jpeg') {
  try {
    log.info('Sending image to HF Spaces YOLO model', {
      imageSize: imageBuffer.length,
      mimeType,
    });

    // Crear FormData para enviar la imagen
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob, 'image.jpg');

    // Llamar a la API de HuggingFace Spaces
    const response = await fetch(HF_SPACES_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HF Spaces API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    log.debug('HF Spaces YOLO response', { result });

    // Procesar las detecciones para buscar bicicletas
    const bikeDetections = findBikeDetections(result);

    // Determinar si hay bicicleta y la confianza máxima
    const hasBike = bikeDetections.length > 0;
    const maxConfidence = hasBike ? Math.max(...bikeDetections.map((d) => d.confidence)) : null;

    log.info('Bike detection result', {
      hasBike,
      confidence: maxConfidence,
      totalDetections: result?.detections?.length || 0,
      bikeDetections: bikeDetections.length,
    });

    return {
      hasBike,
      confidence: maxConfidence,
      detections: bikeDetections,
      raw: result, // Incluir respuesta completa por si se necesita debug
    };
  } catch (error) {
    log.error('Error detecting bike', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Bike detection failed: ${error.message}`);
  }
}

/**
 * Filtra las detecciones para encontrar bicicletas
 *
 * @param {object} yoloResult - Resultado del modelo YOLO
 * @returns {Array<{class: string, class_name: string, confidence: number, bbox: Array}>}
 */
function findBikeDetections(yoloResult) {
  // Formato esperado: { detections: [{ class: 0, class_name: "bicycle", confidence: 0.917, bbox: [...] }] }
  if (!yoloResult || !Array.isArray(yoloResult.detections)) {
    log.warn('Invalid YOLO result format', { yoloResult });
    return [];
  }

  return yoloResult.detections
    .filter((detection) => {
      const className = (detection.class_name || '').toLowerCase();
      return BIKE_KEYWORDS.some((keyword) => className.includes(keyword));
    })
    .map((detection) => ({
      class: detection.class,
      class_name: detection.class_name,
      confidence: detection.confidence || 0,
      bbox: detection.bbox || null,
    }));
}
