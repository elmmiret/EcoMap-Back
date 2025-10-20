const admin = require('firebase-admin');

/**
 * Middleware para verificar la validez del token de ID de Firebase
 * y adjuntar los datos del usuario a la solicitud (req.user).
 */
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Acceso denegado. Formato de token inválido o no proporcionado (espera: "Bearer <token>").' 
    });
  }
  const idToken = authHeader.split('Bearer ')[1]; 

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    // El token es válido. Adjuntamos los datos del usuario a la solicitud
    req.user = decodedToken;
    next();
  } catch (error) {
    // El token no es válido o ha expirado
    console.error('Error al verificar el token de Firebase:', error);
    return res.status(403).json({ error: 'Token inválido o expirado. Acceso no autorizado.'});
  }
};

module.exports = {
  authenticateUser,
};