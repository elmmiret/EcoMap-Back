import xss from 'xss';

/**
 * Middleware to validate and sanitize chat messages
 */
export const validateChatMessage = (req, res, next) => {
  const { content, media } = req.body;
  const MAX_CONTENT_LENGTH = 1000;
  const MAX_MEDIA_COUNT = 10;
  const MAX_URL_LENGTH = 2048;

  // If content is present, validate length and sanitize
  if (content !== undefined && content !== null) {
    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: 'El contenido del mensaje debe ser una cadena de texto.',
      });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'MESSAGE_TOO_LONG',
        message: `El mensaje no puede exceder los ${MAX_CONTENT_LENGTH} caracteres.`,
      });
    }

    // Sanitize content to prevent XSS
    // We allow no HTML tags for chat messages
    req.body.content = xss(content, {
      whiteList: {}, // No tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script'], // Remove script tags and their content
    });
  }

  // Validate media if present
  if (media !== undefined && media !== null) {
    if (!Array.isArray(media)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_MEDIA_TYPE',
        message: 'El campo media debe ser un array.',
      });
    }

    if (media.length > MAX_MEDIA_COUNT) {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_MEDIA',
        message: `No se pueden enviar más de ${MAX_MEDIA_COUNT} archivos multimedia por mensaje.`,
      });
    }

    // Validate each media URL
    for (let i = 0; i < media.length; i++) {
      const url = media[i];

      if (typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_MEDIA_URL_TYPE',
          message: `El elemento ${i + 1} de media debe ser una cadena de texto (URL).`,
        });
      }

      if (url.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'EMPTY_MEDIA_URL',
          message: `El elemento ${i + 1} de media no puede estar vacío.`,
        });
      }

      if (url.length > MAX_URL_LENGTH) {
        return res.status(400).json({
          success: false,
          error: 'MEDIA_URL_TOO_LONG',
          message: `La URL del elemento ${i + 1} de media es demasiado larga (máximo ${MAX_URL_LENGTH} caracteres).`,
        });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'INVALID_MEDIA_URL_FORMAT',
          message: `El elemento ${i + 1} de media no es una URL válida.`,
        });
      }

      // Optional: Validate URL protocol (only https for security)
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          error: 'INSECURE_MEDIA_URL',
          message: `El elemento ${i + 1} de media debe usar HTTPS.`,
        });
      }
    }

    // Sanitize URLs (trim whitespace)
    req.body.media = media.map((url) => url.trim());
  }

  next();
};
