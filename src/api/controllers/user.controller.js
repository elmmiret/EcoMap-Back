// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { pool } from '../../db.js'; //importar el pool de conexión

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 */
export const syncUserToPostgres = async (req, res) => {
  // Los datos del usuario (uid, email) vienen verificados del middleware req.user
  const { uid, email } = req.user;

  // Validación básica de los datos
  if (!uid || !email) {
    return res.status(400).json({
      success: false,
      message: 'Datos de usuario incompletos (uid o email faltante).',
      code: 'INCOMPLETE_DATA',
    });
  }

  try {
    // mirar si el usuario ya existe en la bd
    const checkResult = await pool.query('SELECT uid, email FROM users WHERE uid = $1', [uid]);

    if (checkResult.rows.length === 0) {
      // si el usuario no existe, se inserta
      await pool.query('INSERT INTO users (uid, email) VALUES ($1, $2)', [uid, email]);
      console.log(`Nuevo usuario registrado en PostgreSQL: ${uid}`);

      return res.status(201).json({
        success: true,
        message: 'Usuario sincronizado correctamente',
        user: { uid, email },
      });
    } else {
      console.log(`Usuario ya existente en PostgreSQL: ${uid}`);

      return res.status(200).json({
        success: true,
        message: 'Usuario ya existía',
        user: checkResult.rows[0],
      });
    }
  } catch (error) {
    console.error('Error synchronizing user with PostgreSQL:', error);

    // manejo de errores específicos
    if (error.code === '23505') {
      // Código de error para violación de clave única en PostgreSQL
      return res.status(409).json({
        success: false,
        message: 'El usuario ya existe en la base de datos.',
        code: 'USER_EXISTS',
      });
    }

    // respuesta genérica para otros errores
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al sincronizar el usuario en la base de datos.',
      code: 'DATABASE_ERROR',
    });
  }
};
