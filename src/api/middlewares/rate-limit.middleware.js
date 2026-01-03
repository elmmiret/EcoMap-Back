import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for chat messages
 * Limits users to 20 messages per minute to prevent spam
 */
export const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Has enviado demasiados mensajes. Por favor espera un momento.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use user ID for authenticated requests, skip for better security
  skip: (req) => !req.user, // Only apply to authenticated users
  keyGenerator: (req) => {
    // Always use user ID for authenticated requests (middleware ensures req.user exists)
    return req.user.uid;
  },
});
