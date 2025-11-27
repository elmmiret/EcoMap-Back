import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_ALGORITHM = 'HS256'; // Algoritmo consistente

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en las variables de entorno');
}

export function signUserJWT(payload) {
  const token = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM // Especificar algoritmo al firmar
  });
  const decoded = jwt.decode(token);
  const expiryDate = new Date(decoded.exp * 1000);
  return { token, expiryDate };
}

export const JWT_CONFIG = {
  algorithm: JWT_ALGORITHM,
  secret: JWT_SECRET,
};
