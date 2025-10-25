// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { prisma } from '#lib/prisma.js';
import { signUserJWT } from '#lib/jwt.js';
import { getFirebaseAuth } from '#config/firebase.js';

// Debug helper to keep logs consistent
const dbg = (...args) => console.log('[syncUserToPostgres]', ...args);

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 * Distingue entre registro manual (con datos en el body) y social (datos de Firebase).
 * Crea: user -> registered_user -> client
 */
export const syncUserToPostgres = async (req, res) => {
  // UID del token de Firebase (siempre presente gracias al middleware)
  const { uid: firebaseUID } = req.user;

  dbg('Inicio handler', { firebaseUID, bodyKeys: Object.keys(req.body || {}) });

  try {
    // --- 1. ¿El usuario ya existe? (Lógica de LOGIN) ---
    dbg('Consultando si el usuario ya existe en la BD', { user_id: firebaseUID });
    const existingUser = await prisma.registered_user.findUnique({
      where: { user_id: firebaseUID },
      include: {
        client: true, // para obtener profile_picture, points, streak
        admin: true, // para rol
        institution: true, // para rol
      },
    });

    if (existingUser) {
      dbg('Usuario existente encontrado -> INICIO DE SESIÓN', { user_id: existingUser.user_id });

      // Limpiar sesiones expiradas para este usuario
      const { count: deletedCount } = await prisma.session.deleteMany({
        where: {
          user_id: firebaseUID,
          expiry_date: { lt: new Date() },
        },
      });
      if (deletedCount > 0) {
        dbg('Sesiones expiradas eliminadas', { count: deletedCount });
      }

      // Determinar el rol del usuario
      let role = 'client';
      if (existingUser.admin) role = 'admin';
      if (existingUser.institution) role = 'institution';

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
          user_id: firebaseUID,
        },
      });
      dbg('Nueva sesión almacenada para usuario existente');

      return res.status(200).json({
        success: true,
        message: 'Inicio de sesión correcto.',
        jwt: token,
        expiryDate: expiryDate.toISOString(),
      });
    }

    // --- 2. Si no existe, es un REGISTRO ---
    dbg('Usuario no existe -> REGISTRO');
    const { name: bodyName, email: bodyEmail, username: bodyUsername } = req.body;
    const isManualRegistration = !!(bodyName && bodyEmail); // Username es opcional

    const userData = {
      uid: firebaseUID,
      email: '',
      name: '',
      surname: '',
      username: null,
      profile_picture: null,
      phone: null,
    };

    if (isManualRegistration) {
      // --- REGISTRO MANUAL ---
      dbg('Detectado REGISTRO MANUAL');
      userData.email = bodyEmail;
      userData.username = bodyUsername || null;
      const nameParts = bodyName.split(' ');
      userData.name = nameParts[0];
      userData.surname = nameParts.slice(1).join(' ');
    } else {
      // --- REGISTRO SOCIAL (Google, etc.) ---
      dbg('Detectado REGISTRO SOCIAL (obteniendo datos de Firebase)');
      const auth = getFirebaseAuth();
      const userRecord = await auth.getUser(firebaseUID);

      dbg('Datos RAW de Firebase userRecord:', {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        phoneNumber: userRecord.phoneNumber,
      });

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
          userData.phone = parseInt(userRecord.phoneNumber.replace('+', ''));
        } catch (e) {
          console.warn(`No se pudo parsear el número de teléfono: ${userRecord.phoneNumber}.`);
        }
      }
    }

    // Validaciones finales de datos para el registro
    if (!userData.uid || !userData.email || !userData.name) {
      dbg('Validación de registro fallida: faltan uid, email o nombre', { userData });
      return res.status(400).json({
        success: false,
        message: 'Datos de registro incompletos (uid, email o nombre).',
        code: 'INCOMPLETE_REGISTRATION_DATA',
      });
    }

    dbg('Datos de usuario normalizados para creación', {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
    });

    // --- 3. Crear el usuario completo en una transacción ---
    dbg('Iniciando transacción de creación de usuario');
    const { registeredUser, client } = await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { user_id: userData.uid } });
      dbg('Fila creada en tabla `user`');

      const newRegisteredUser = await tx.registered_user.create({
        data: {
          user_id: userData.uid,
          name: userData.name,
          email: userData.email,
          app_language: 'Spanish', // Valor por defecto
          ...(userData.surname && { surname: userData.surname }),
          ...(userData.username && { username: userData.username }),
        },
      });
      dbg('Fila creada en tabla `registered_user`');

      const newClient = await tx.client.create({
        data: {
          user_id: userData.uid,
          points: 0,
          streak: 0,
          ...(userData.profile_picture && { profile_picture: userData.profile_picture }),
          ...(userData.phone && { phone: userData.phone }),
        },
      });
      dbg('Fila creada en tabla `client`');

      return { registeredUser: newRegisteredUser, client: newClient };
    });

    dbg('Transacción de creación completada');

    // --- 4. Generar y devolver JWT para el nuevo usuario ---
    const jwtPayload = {
      uid: registeredUser.user_id,
      email: registeredUser.email,
      name: registeredUser.name,
      surname: registeredUser.surname,
      username: registeredUser.username || null,
      profile_picture: client.profile_picture || null,
      role: 'client', // Rol por defecto para nuevos registros
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
    dbg('Sesión almacenada para nuevo usuario');

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado y sincronizado correctamente.',
      jwt: token,
      expiryDate: expiryDate.toISOString(),
    });
  } catch (error) {
    console.error('Error en syncUserToPostgres:', error);
    dbg('Detalles del error:', {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'El email o identificador de usuario ya existe.',
        code: 'USER_ALREADY_EXISTS',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al sincronizar el usuario.',
      code: 'DATABASE_ERROR',
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
