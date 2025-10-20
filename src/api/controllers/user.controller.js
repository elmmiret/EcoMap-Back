// CONTIENE LA LOGICA (getUser, createUser, etc.)

const { pool } = require('../../db'); //importar el pool de conexión

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 */
const syncUserToPostgres = async (req, res) => {
    // Los datos del usuario (uid, email) vienen verificados del middleware req.user
    const { uid, email } = req.user; 

  try {
    // mirar si el usuario ya existe en la bd
    const checkResult = await pool.query('SELECT uid FROM users WHERE uid = $1', [uid]);

    if (checkResult.rows.length === 0) {
        // si el usuario no existe, se inserta
        await pool.query('INSERT INTO users (uid, email) VALUES ($1, $2)', [uid, email]);
        console.log(`New user registered in Postgres: ${uid}`);
    }

    // devuelve que no ha habido errores
    res.status(200).json({ 
        message: 'User synchronization successful', 
        uid: uid 
    });

    } catch (error) {
        console.error('Error synchronizing user with PostgreSQL:', error);
        // devuelve error si la bd falla
        res.status(500).json({ 
            error: 'Server internal error while synchronizing the user in the DB' 
        });
    }
};

module.exports = {
  syncUserToPostgres,
};