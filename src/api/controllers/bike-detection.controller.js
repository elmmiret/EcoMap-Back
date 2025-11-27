/**
 * Bike Detection Controller
 *
 * Endpoint para detectar bicicletas en imágenes
 */

import multer from 'multer';
import { detectBike } from '#services/bike-detection.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('bike-detection-controller');

// Configurar multer para manejar uploads en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Validar que sea una imagen
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Middleware de multer exportado para usar en la ruta
export const uploadImage = upload.single('image');

/**
 * POST /api/bikes
 * Detecta si hay una bicicleta en la imagen subida
 *
 * Body: multipart/form-data con campo "image"
 * Response: { hasBike: boolean, confidence: number|null, detections: Array }
 */
export async function detectBikeInImage(req, res) {
  try {
    // Validar que se haya subido una imagen
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided. Please upload an image with key "image"',
      });
    }

    log.info('Processing bike detection request', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Llamar al servicio de detección
    const result = await detectBike(req.file.buffer, req.file.mimetype);

    // Responder al cliente
    res.status(200).json({
      success: true,
      data: {
        hasBike: result.hasBike,
        confidence: result.confidence,
        count: result.detections.length,
        items: result.detections,
      },
    });
  } catch (error) {
    log.error('Error in bike detection endpoint /api/bikes', {
      error: error.message,
      stack: error.stack,
    });

    // Error del servicio externo
    if (error.message.includes('HF Spaces')) {
      return res.status(503).json({
        success: false,
        error: 'External detection service unavailable',
        message: error.message,
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      error: 'Internal server error during bike detection',
      message: error.message,
    });
  }
}

/**
 * Middleware para manejar errores de multer
 */
export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  next();
}
