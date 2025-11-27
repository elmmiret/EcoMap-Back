/**
 * Waste Detection Service
 *
 * Integración con HuggingFace Spaces YOLO para detectar basura en imágenes
 */

import { createLogger } from '#lib/logger.js';

const log = createLogger('waste-detection');

// URL del servicio externo de detección
const HF_SPACES_URL = 'https://tacosrra-ecomap-ai.hf.space/recycling';

// Palabras clave que identifican basura en las detecciones YOLO
// Clases específicas del modelo
const WASTE_KEYWORDS = [
  'ElectricContainer',
  'GlassContainer',
  'OrganicContainer',
  'PaperContainer',
  'PlasticContainer',
  'TextileContainer',
  'Unrecyclable',
];

/**
 * Detecta si hay basura en una imagen usando el modelo YOLO en HuggingFace Spaces
 *
 * @param {Buffer} imageBuffer - Buffer de la imagen a analizar
 * @param {string} mimeType - Tipo MIME de la imagen (ej: 'image/jpeg', 'image/png')
 * @returns {Promise<{hasWaste: boolean, confidence: number|null, detections: Array, raw: object}>}
 */
export async function detectWaste(imageBuffer, mimeType = 'image/jpeg') {
  try {
    log.info('Sending image to HF Spaces YOLO model (Waste)', {
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
    log.debug('HF Spaces YOLO response (Waste)', { result });

    // Procesar las detecciones para buscar basura
    const wasteDetections = findWasteDetections(result);

    // Determinar si hay basura y la confianza máxima
    const hasWaste = wasteDetections.length > 0;
    const maxConfidence = hasWaste ? Math.max(...wasteDetections.map((d) => d.confidence)) : null;

    log.info('Waste detection result', {
      hasWaste,
      confidence: maxConfidence,
      totalDetections: result?.detections?.length || 0,
      wasteDetections: wasteDetections.length,
    });

    return {
      hasWaste,
      confidence: maxConfidence,
      detections: wasteDetections,
      raw: result, // Incluir respuesta completa por si se necesita debug
    };
  } catch (error) {
    log.error('Error detecting waste', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Waste detection failed: ${error.message}`);
  }
}

/**
 * Filtra las detecciones para encontrar basura con confianza > 50%
 *
 * @param {object} yoloResult - Resultado del modelo YOLO
 * @returns {Array<{class: string, class_name: string, confidence: number, bbox: Array}>}
 */
function findWasteDetections(yoloResult) {
  // Formato esperado: { detections: [{ class: 0, class_name: "bottle", confidence: 0.917, bbox: [...] }] }
  if (!yoloResult || !Array.isArray(yoloResult.detections)) {
    log.warn('Invalid YOLO result format', { yoloResult });
    return [];
  }

  return yoloResult.detections
    .filter((detection) => {
      // Filtrar por confianza > 0.5 (50%)
      if (!detection.confidence || detection.confidence <= 0.5) {
        return false;
      }

      // El modelo devuelve nombres de clases específicos.
      // Comprobamos si el nombre de la clase detectada está en nuestra lista de interés.
      // Hacemos la comparación case-insensitive por seguridad.
      const className = detection.class_name;
      if (!className) return false;

      return WASTE_KEYWORDS.some((keyword) => keyword.toLowerCase() === className.toLowerCase());
    })
    .map((detection) => ({
      class: detection.class,
      class_name: detection.class_name,
      confidence: detection.confidence || 0,
      bbox: detection.bbox || null,
    }));
}
