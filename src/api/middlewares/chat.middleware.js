import xss from 'xss';

/**
 * Middleware to validate and sanitize chat messages
 */
export const validateChatMessage = (req, res, next) => {
  const { content } = req.body;
  const MAX_LENGTH = 1000;

  // If content is present, validate length and sanitize
  if (content && typeof content === 'string') {
    if (content.length > MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'MESSAGE_TOO_LONG',
        message: `El mensaje no puede exceder los ${MAX_LENGTH} caracteres.`,
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

  next();
};
