import { validateAndNormalizePhone } from '#lib/validators.js';

/**
 * Middleware para validar y normalizar el campo phone en el body
 * Uso: app.put('/api/users/me', validatePhone, updateUser)
 */
export function validatePhone(req, res, next) {
  // Si no hay phone en el body, pasar al siguiente middleware
  if (!req.body.phone) {
    return next();
  }

  const { valid, normalized, error } = validateAndNormalizePhone(req.body.phone);

  if (!valid) {
    return res.status(400).json({
      success: false,
      message: error || 'Formato de teléfono inválido',
      code: 'INVALID_PHONE_FORMAT',
      hint: 'El formato debe ser: +{prefijo} {número}. Ejemplo: +34 612345678',
    });
  }

  // Reemplazar el valor del body con el normalizado
  req.body.phone = normalized;
  next();
}
