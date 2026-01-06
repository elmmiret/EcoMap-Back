import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en las variables de entorno');
}

export function signUserJWT(payload) {
  // Agregar timestamp único para evitar JWTs duplicados en llamadas simultáneas
  const uniquePayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000), // issued at time
    jti: `${payload.uid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // unique JWT ID
  };

  const token = jwt.sign(uniquePayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const decoded = jwt.decode(token);
  const expiryDate = new Date(decoded.exp * 1000);
  return { token, expiryDate };
}
