// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { prisma } from '#lib/prisma.js';
import { signUserJWT } from '#lib/jwt.js';
import { getFirebaseAuth } from '#config/firebase.js';

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 * Distingue entre registro manual (con datos en el body) y social (datos de Firebase).
 * Crea: user -> registered_user -> client
 */
export const syncUserToPostgres = async (req, res) => {
  // UID del token de Firebase (siempre presente)
  const { uid: firebaseUID } = req.user;
  // Datos del body (para registro manual)
  const { name: bodyName, email: bodyEmail, username: bodyUsername } = req.body;

  const isManualRegistration = !!(bodyName && bodyEmail && bodyUsername);

  try {
    // --- 1. Validar y preparar los datos del usuario ---
    const userData = {
      uid: firebaseUID,
      email: '',
      name: '',
      surname: '',
      username: isManualRegistration ? bodyUsername : null,
      profile_picture: null,
      phone: null,
    };

    if (isManualRegistration) {
      // --- REGISTRO MANUAL ---
      userData.email = bodyEmail;
      const nameParts = bodyName.split(' ');
      userData.name = nameParts[0];
      userData.surname = nameParts.slice(1).join(' ');
    } else {
      // --- REGISTRO SOCIAL (Google) ---
      const auth = getFirebaseAuth();
      const userRecord = await auth.getUser(firebaseUID);

      userData.email = userRecord.email;
      userData.username = userRecord.email ? userRecord.email.split('@')[0] : null;
      userData.profile_picture = userRecord.photoURL || null;

      if (userRecord.displayName) {
        const nameParts = userRecord.displayName.split(' ');
        userData.name = nameParts[0];
        userData.surname = nameParts.slice(1).join(' ');
      }

      if (userRecord.phoneNumber) {
        try {
          // Intenta parsear, pero asume formato internacional E.164
          userData.phone = parseInt(userRecord.phoneNumber.replace('+', ''));
        } catch (e) {
          console.warn(`Could not parse phone number: ${userRecord.phoneNumber}. Error: ${e?.message || e}`);
        }
      }
    }

    // Validaciones finales de datos
    if (!userData.uid || !userData.email) {
      return res.status(400).json({
        success: false,
        message: 'Datos de usuario incompletos (uid o email faltante).',
        code: 'INCOMPLETE_DATA',
      });
    }
    if (!userData.name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del usuario es obligatorio.',
        code: 'NAME_REQUIRED',
      });
    }

    // --- 2. Verificar si el usuario ya existe ---
    const existingUser = await prisma.registered_user.findUnique({
      where: { user_id: userData.uid },
      include: {
        client: true,
      },
    });

    if (existingUser) {
      // Usuario ya existe, solo refrescar sesión
      let role = 'client';
      if (existingUser.admin) role = 'admin';
      if (existingUser.institution) role = 'institution';

      // Limpiar sesiones expiradas
      await prisma.session.deleteMany({
        where: {
          user_id: userData.uid,
          expiry_date: { lt: new Date() },
        },
      });

      // Generar y guardar nuevo JWT
      const jwtPayload = {
        uid: existingUser.user_id,
        email: existingUser.email,
        name: existingUser.name,
        surname: existingUser.surname,
        username: existingUser.username || null,
        profile_picture: existingUser.client?.profile_picture || null,
        role,
        points: existingUser.client?.points || 0,
        streak: existingUser.client?.streak || 0,
      };
      const { token, expiryDate } = signUserJWT(jwtPayload);

      await prisma.session.create({
        data: {
          jwt: token,
          expiry_date: expiryDate,
          user_id: userData.uid,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Usuario ya existía',
        jwt: token,
        expiryDate: expiryDate.toISOString(),
      });
    }

    // --- 3. Crear el usuario completo si no existe ---
    const { registeredUser, client } = await prisma.$transaction(async (tx) => {
      // 1. Crear user base
      await tx.user.create({ data: { user_id: userData.uid } });

      // 2. Crear registered_user
      const registeredUser = await tx.registered_user.create({
        data: {
          user_id: userData.uid,
          name: userData.name,
          email: userData.email,
          app_language: 'Spanish',
          ...(userData.surname && { surname: userData.surname }),
          ...(userData.username && { username: userData.username }),
        },
      });

      // 3. Crear client asociado
      const client = await tx.client.create({
        data: {
          user_id: userData.uid,
          points: 0,
          streak: 0,
          ...(userData.profile_picture && { profile_picture: userData.profile_picture }),
          ...(userData.phone && { phone: userData.phone }),
        },
      });

      return { registeredUser, client };
    });

    // --- 4. Generar y devolver JWT para el nuevo usuario ---
    const role = 'client';
    const jwtPayload = {
      uid: registeredUser.user_id,
      email: registeredUser.email,
      name: registeredUser.name,
      surname: registeredUser.surname,
      username: registeredUser.username || null,
      profile_picture: client.profile_picture || null,
      role,
      points: client.points,
      streak: client.streak,
    };
    const { token, expiryDate } = signUserJWT(jwtPayload);

    await prisma.session.create({
      data: {
        jwt: token,
        expiry_date: expiryDate,
        user_id: userData.uid,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Usuario y cliente sincronizados correctamente',
      jwt: token,
      expiryDate: expiryDate.toISOString(),
    });
  } catch (error) {
    console.error('Error synchronizing user with PostgreSQL:', error);

    // Manejo de errores específicos de Prisma
    if (error.code === 'P2002') {
      // Violación de constraint único (email duplicado)
      return res.status(409).json({
        success: false,
        message: 'El usuario ya existe en la base de datos.',
        code: 'USER_EXISTS',
      });
    }

    if (error.code === 'P2003') {
      // Violación de foreign key
      return res.status(400).json({
        success: false,
        message: 'Error de referencia en la base de datos.',
        code: 'FOREIGN_KEY_ERROR',
      });
    }

    // Respuesta genérica para otros errores
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al sincronizar el usuario en la base de datos.',
      code: 'DATABASE_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
};

/**
 * Lógica para cerrar la sesión de un usuario.
 */
export const logoutUser = async (req, res) => {
  // El middleware `authenticateUser` ya verificó el token y adjuntó el payload a `req.user`
  // y el token en sí a `req.token`
  const { uid } = req.user;
  const token = req.token;

  if (!uid || !token) {
    return res.status(400).json({
      success: false,
      message: 'Token o UID de usuario no proporcionado.',
      code: 'BAD_REQUEST',
    });
  }

  try {
    // Eliminar la sesión de la base de datos
    await prisma.session.deleteMany({
      where: {
        user_id: uid,
        jwt: token,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Sesión cerrada correctamente.',
    });
  } catch (error) {
    console.error('Error al cerrar la sesión:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al cerrar la sesión.',
      code: 'DATABASE_ERROR',
    });
  }
};

export const deleteUserFromPostgres = async (_req, _res) => {};
