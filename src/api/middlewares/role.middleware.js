// src/api/middlewares/role.middleware.js

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const INSTITUTION_SECRET_KEY = process.env.INSTITUTION_SECRET_KEY;
const PARTNER_SECRET_KEY = process.env.PARTNER_SECRET_KEY;

/**
 * @middleware requireRoleSecret
 * @description Verifica que se proporcione una clave secreta correcta en el header
 * para permitir el registro de roles privilegiados ('admin', 'institution', 'partner').
 * Solo permite la creación de 'client' sin clave secreta.
 */
export const requireRoleSecret = (req, res, next) => {
  const { role: requestRole } = req.body;

  // Validamos que el rol sea uno de los conocidos, si no, por defecto será 'client'
  const roleToAssign = ['client', 'admin', 'institution', 'partner'].includes(requestRole) ? requestRole : 'client';

  // 1. Si es 'client', es público. Pasamos directamente.
  if (roleToAssign === 'client') {
    return next();
  }

  // 2. Para el resto (admin, institution, partner), requerimos clave en el header.
  const submittedSecret = req.headers['x-role-secret'];

  if (!submittedSecret) {
    console.warn(`[RoleSecretMiddleware] Acceso denegado: Registro como '${roleToAssign}' sin secret key.`);
    return res.status(403).json({
      success: false,
      message: `Se requiere una clave secreta en el encabezado 'x-role-secret' para el rol ${roleToAssign}.`,
      code: 'SECRET_REQUIRED',
    });
  }

  // 3. Determinamos qué clave se necesita según el rol
  let requiredSecret = null;

  switch (roleToAssign) {
    case 'admin':
      requiredSecret = ADMIN_SECRET_KEY;
      break;
    case 'institution':
      requiredSecret = INSTITUTION_SECRET_KEY;
      break;
    case 'partner':
      requiredSecret = PARTNER_SECRET_KEY;
      break;
  }

  // Verificar configuración del servidor (por si olvidaste poner la clave en el .env)
  if (!requiredSecret) {
    console.error(`[RoleSecretMiddleware] Error crítico: No hay clave configurada en el servidor para ${roleToAssign}.`);
    return res.status(500).json({
      success: false,
      message: 'Error de configuración del servidor. Contacte con soporte.',
      code: 'SERVER_CONFIGURATION_ERROR',
    });
  }

  // 4. Comparamos las claves
  if (submittedSecret !== requiredSecret) {
    console.warn(`[RoleSecretMiddleware] Clave incorrecta para rol ${roleToAssign}.`);
    return res.status(403).json({
      success: false,
      message: 'Clave secreta no válida para el rol solicitado.',
      code: 'INVALID_SECRET',
    });
  }

  // Éxito: El usuario tiene la clave correcta para el rol que pide
  console.log(`[RoleSecretMiddleware] Autorizado registro de nuevo ${roleToAssign}.`);
  next();
};
