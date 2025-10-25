import admin from 'firebase-admin';

/**
 * Middleware para verificar la validez del token de ID de Firebase
 * y adjuntar los datos del usuario a la solicitud (req.user).
 */
export const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso denegado. Formato de token inválido o no proporcionado (espera: "Bearer <token>").',
    });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    // si el token es válido, adjuntamos los datos del usuario a la solicitud
    req.user = decodedToken;
    next();
  } catch (error) {
    // Manejo de errores específicos
    console.error('Error al verificar el token de Firebase:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(403).json({ error: 'El token ha expirado. Por favor, inicia sesión nuevamente.' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(400).json({ error: 'El token proporcionado no es válido.' });
    } else {
      // Error genérico
      return res.status(403).json({ error: 'Token inválido o acceso no autorizado.' });
    }
  }
};
