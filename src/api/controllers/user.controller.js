// CONTIENE LA LOGICA (getUser, createUser, etc.)

const { pool } = import('../../db'); //importar el pool de conexión

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 */
const syncUserToPostgres = async (req, res) => {
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
            uid: uid 
        });

        } catch (error) {
            console.error('Error synchronizing user with PostgreSQL:', error);
            
            // manejo de errores específicos
            if (error.code === '23505') { // Código de error para violación de clave única en PostgreSQL
                return res.status(409).json({ error: 'El usuario ya existe en la base de datos.' });
            }

            // respuesta genérica para otros errores
            res.status(500).json({ 
                error: 'Error interno del servidor al sincronizar el usuario en la base de datos.',
            });
        }
};

module.exports = {
  syncUserToPostgres,
};