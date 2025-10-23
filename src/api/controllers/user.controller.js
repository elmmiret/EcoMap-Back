// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { pool } from '../../db.js'; //importar el pool de conexión
import admin from 'firebase-admin';

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 */
export const syncUserToPostgres = async (req, res) => {
  // Los datos del usuario (uid, email) vienen verificados del middleware req.user
  const { uid, email } = req.user;

  // Validación básica de los datos
  if (!uid || !email) {
    return res.status(400).json({ error: 'Datos de usuario incompletos (uid o email faltante).' });
  }

  try {
    // mirar si el usuario ya existe en la bd
    const checkResult = await pool.query('SELECT uid FROM users WHERE uid = $1', [uid]);

    if (checkResult.rows.length === 0) {
      // si el usuario no existe, se inserta
      await pool.query('INSERT INTO users (uid, email) VALUES ($1, $2)', [uid, email]);
      console.log(`Nuevo usuario registrado en PostgreSQL: ${uid}`);
    } else {
      console.log(`Usuario ya existente en PostgreSQL: ${uid}`);
    }

    // devuelve que no ha habido errores
    res.status(200).json({
      message: 'Sincronización de usuario exitosa',
      uid: uid,
    });
  } catch (error) {
    console.error('Error synchronizing user with PostgreSQL:', error);

    // manejo de errores específicos
    if (error.code === '23505') {
      // Código de error para violación de clave única en PostgreSQL
      return res.status(409).json({ error: 'El usuario ya existe en la base de datos.' });
    }

    // respuesta genérica para otros errores
    res.status(500).json({
      error: 'Error interno del servidor al sincronizar el usuario en la base de datos.',
    });
  }
};

/**
 * Lógica para eliminar el usuario de Firebase y de PostgreSQL.
 */
export const deleteUserFromPostgres = async (req, res) => {
  const { uid } = req.user; // obtiene el uid verificado del middleware

  if(!uid) {
    return res.status(400).json({ error: 'UID de usuario no proporcionado en el token.'});
  }

  try {
    // eliminar de postgreSQL (usa el pool.query de db.js)
    const dbResult = await pool.query('DELETE FROM users WHERE uid = $1 RETURNING uid', [uid]);

    if(dbResult.rows.length === 0) {
      console.warn(`Usuario ${uid} no encontrado en PostreSQL (continuando a Firebase).`);
    }
    else {
      console.log(`Usuario ${uid} eliminado de PostgreSQL.`);
    }

    // eliminar de Firebase
    await admin.auth().deleteUser(uid);
    console.log(`Usuario ${uid} eliminado de Firebase.`);

    // respuesta exitosa
    res.status(200).json({
      message: 'Usuario eliminado exitosamente de Firebase y PostgreSQL.',
      uid: uid,
    });
  }
  catch (error) {
    console.error('Error al intentar eliminar el usuario:', error);

    // manejo de errores de Firebase
    if(error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Usuario no encontrado en Firebase.' });
    }

    // error genérico
    res.status(500).json({
      error: 'Error interno del servidor al intentar eliminar el usuario.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }

}