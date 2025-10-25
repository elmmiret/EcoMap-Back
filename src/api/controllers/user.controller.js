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
  // UID del token de Firebase (siempre presente)
  const { uid: firebaseUID } = req.user;
  // Datos del body (para registro manual)
  const { name: bodyName, email: bodyEmail, username: bodyUsername } = req.body;

  const isManualRegistration = !!(bodyName && bodyEmail && bodyUsername);

  dbg('Inicio handler', {
    firebaseUID,
    isManualRegistration,
    bodyKeys: Object.keys(req.body || {}),
    body: req.body,
  });

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
      dbg('Registro manual detectado');
      userData.email = bodyEmail;
      const nameParts = bodyName.split(' ');
      userData.name = nameParts[0];
      userData.surname = nameParts.slice(1).join(' ');
    } else {
      // --- REGISTRO SOCIAL (Google) ---
      dbg('Registro social detectado; obteniendo datos de Firebase');
      const auth = getFirebaseAuth();
      const userRecord = await auth.getUser(firebaseUID);

      dbg('Datos RAW de Firebase userRecord:', {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        phoneNumber: userRecord.phoneNumber,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        providerData: userRecord.providerData,
      });

      userData.email = userRecord.email;
      userData.username = userRecord.email ? userRecord.email.split('@')[0] : null;
      userData.profile_picture = userRecord.photoURL || null;

      dbg('Datos básicos extraídos:', {
        email: userData.email,
        username: userData.username,
        profile_picture: userData.profile_picture,
      });

      if (userRecord.displayName) {
        const nameParts = userRecord.displayName.split(' ');
        userData.name = nameParts[0];
        userData.surname = nameParts.slice(1).join(' ');
        dbg('Nombre parseado desde displayName:', {
          displayName: userRecord.displayName,
          name: userData.name,
          surname: userData.surname,
          nameParts,
        });
      } else {
        dbg('WARNING: displayName NO está presente en userRecord de Firebase');
      }

      if (userRecord.phoneNumber) {
        try {
          // Intenta parsear, pero asume formato internacional E.164
          userData.phone = parseInt(userRecord.phoneNumber.replace('+', ''));
          dbg('Teléfono parseado:', {
            phoneNumber: userRecord.phoneNumber,
            parsedPhone: userData.phone,
          });
        } catch (e) {
          console.warn(`Could not parse phone number: ${userRecord.phoneNumber}. Error: ${e?.message || e}`);
          dbg('Error al parsear teléfono:', {
            phoneNumber: userRecord.phoneNumber,
            error: e?.message || e,
          });
        }
      } else {
        dbg('phoneNumber NO está presente en userRecord de Firebase');
      }

      dbg('Datos finales de userData después de registro social:', userData);
    }

    // Validaciones finales de datos
    if (!userData.uid || !userData.email) {
      dbg('Validación fallida: uid o email faltante', {
        hasUid: !!userData.uid,
        hasEmail: !!userData.email,
      });
      return res.status(400).json({
        success: false,
        message: 'Datos de usuario incompletos (uid o email faltante).',
        code: 'INCOMPLETE_DATA',
      });
    }
    if (!userData.name) {
      dbg('Validación fallida: nombre faltante');
      return res.status(400).json({
        success: false,
        message: 'El nombre del usuario es obligatorio.',
        code: 'NAME_REQUIRED',
      });
    }

    dbg('Datos de usuario normalizados', {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      surname: userData.surname,
      username: userData.username,
      hasProfilePicture: !!userData.profile_picture,
      hasPhone: !!userData.phone,
    });

    // --- 2. Verificar si el usuario ya existe ---
    dbg('Consultando si el usuario ya existe en registered_user', { user_id: userData.uid });
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

      dbg('Usuario existente encontrado. Refrescando sesión', {
        user_id: existingUser.user_id,
        role,
        hasClient: !!existingUser.client,
      });

      // Limpiar sesiones expiradas
      const deleteExpired = await prisma.session.deleteMany({
        where: {
          user_id: userData.uid,
          expiry_date: { lt: new Date() },
        },
      });
      dbg('Sesiones expiradas eliminadas', { count: deleteExpired?.count || 0 });

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

      dbg('JWT generado para usuario existente', {
        uid: existingUser.user_id,
        expISO: expiryDate?.toISOString?.() || null,
      });

      await prisma.session.create({
        data: {
          jwt: token,
          expiry_date: expiryDate,
          user_id: userData.uid,
        },
      });
      dbg('Nueva sesión almacenada para usuario existente');

      return res.status(200).json({
        success: true,
        message: 'Usuario ya existía',
        jwt: token,
        expiryDate: expiryDate.toISOString(),
      });
    }

    // --- 3. Crear el usuario completo si no existe ---
    dbg('Usuario no existe; iniciando transacción de creación');
    const { registeredUser, client } = await prisma.$transaction(async (tx) => {
      // 1. Crear user base
      dbg('Creando fila en table user');
      const userRow = await tx.user.create({ data: { user_id: userData.uid } });
      dbg('Fila user creada', { user_id: userRow.user_id });

      // 2. Crear registered_user
      dbg('Creando fila en table registered_user');
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
      dbg('Fila registered_user creada', { user_id: registeredUser.user_id });

      // 3. Crear client asociado
      dbg('Creando fila en table client');
      const client = await tx.client.create({
        data: {
          user_id: userData.uid,
          points: 0,
          streak: 0,
          ...(userData.profile_picture && { profile_picture: userData.profile_picture }),
          ...(userData.phone && { phone: userData.phone }),
        },
      });
      dbg('Fila client creada', { user_id: client.user_id });

      return { registeredUser, client };
    });

    dbg('Transacción completada correctamente');

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

    dbg('JWT generado para nuevo usuario', {
      uid: registeredUser.user_id,
      expISO: expiryDate?.toISOString?.() || null,
    });

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
      message: 'Usuario y cliente sincronizados correctamente',
      jwt: token,
      expiryDate: expiryDate.toISOString(),
    });
  } catch (error) {
    console.error('Error synchronizing user with PostgreSQL:', error);
    // Log extendido para diagnóstico
    try {
      dbg('Detalles de error', {
        name: error?.name,
        code: error?.code,
        message: error?.message,
        meta: error?.meta,
      });
    } catch (e) {
      console.warn('[syncUserToPostgres] Error al loguear detalles del error:', e?.message || e);
    }

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
