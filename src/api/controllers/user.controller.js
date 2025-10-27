// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { prisma } from '#lib/prisma.js';
import { signUserJWT } from '#lib/jwt.js';
import { getAuth } from '#services/auth.service.js';

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
      const auth = getAuth();
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
          console.warn(`No se pudo parsear el número de teléfono: ${userRecord.phoneNumber}.`, e);
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
 * Lógica para cambiar el idioma de la aplicación (app_language) de un usuario autenticado.
 */
export const changeAppLanguage = async (req, res) => {
  const dbg = (...args) => console.log('[changeAppLanguage]', ...args);

  // UID y payload actual del JWT del backend
  const { uid, ...currentPayload } = req.user;

  // El token antiguo adjuntado por el middleware (para eliminar la sesión)
  const token = req.token; 
  const { newLanguage } = req.body;

  if (!newLanguage || typeof newLanguage !== 'string' || newLanguage.lenght < 2) {
    dbg('Validación fallida: newLanguage no válido');
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar un idioma válido en el campo "newLanguage" del cuerpo de la solicitud.',
      code: 'INVALID_LANGUAGE',
    });
  }

  try {
    // Comprobar si existe una sesión abierta conn el user_id que solicita el cambio
    const activeSession = await prisma.session.findFirst({
      where: { user_id: uid, jwt: token },
      select: { session_id: true }
    });

    if (!activeSession) {
      dbg('Sesión activa no encontrada para el token proporcionado en la BD.');
      return res.status(401).json({
        success: false,
        message: 'Sesión no encontrada o expirada. Por favor, inicie sesión de nuevo.',
        code: 'SESSION_NOT_FOUND_OR_EXPIRED',
      });
    }
    dbg('Sesión activa encontrada. Procediendo con la actualización.');

    // Actualizar el campo app_language en la base de datos
    const updatedUser = await prisma.registered_user.update({
      where: { user_id: uid},
      data: { app_language: newLanguage },
      include: { client: true }, // para obtener todos los campos necesarios
    });

    dbg(`Idioma actualizado a ${updatedUser.app_language} en la BD.`);

    // Generar un nuevo JWT conn el idioma actualizado
    const newJwtPayload = {
      uid: updatedUser.user_id,
      email: updatedUser.email,
      name: updatedUser.name,
      surname: updatedUser.surname,
      username: updatedUser.username,
      dni: updatedUser.dni || null,
      app_language: updatedUser.app_language,
      profile_picture: updatedUser.client?.profile_picture || null,
      address: updatedUser.client?.address || null,
      phone: updatedUser.client?.phone || null,
      description: updatedUser.client?.description || null,
      birth_date: updatedUser.client?.birth_date
        ? updatedUser.client.birth_date.toISOString().split('T')[0]
        : null,
      role: currentPayload.role || 'client',
      points: updatedUser.client?.points || 0,
      streak: updatedUser.client?.streak || 0,
    };

    const { token: newToken, expiryDate } = signUserJWT(newJwtPayload);

    // Reemplazar la sesión antigua con la nueva en una transacción
    await prisma.$transaction(async (tx) => {
      // Eliminar la sesión antigua (con el token original)
      await tx.session.deleteMany({
        where: { jwt: token, user_id: uid },
      });

      // Crear la nueva sesión (con el nuevo token)
      await tx.session.create({
        data: {
          jwt: newToken,
          expiry_date: expiryDate,
          user_id: uid,
        },
      });
    });

    dbg('Sesión actualizada y nuevo JWT almacenado.');

    // Devolver el nuevo JWT y el idioma
    return res.status(200).json({
      success: true,
      message: `Idioma de la aplicación cambiado a ${updatedUser.app_language}.`,
      jwt: newToken, // devolvemos el nuevo token
      expiryDate: expiryDate.toISOString(),
      newLanguage: updatedUser.app_language,
    });
  }

  catch (error) {
    console.error('Error en changeAppLanguage:', error);
    
    // ... (Manejo de errores P2025 y 500)
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al cambiar el idioma.',
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

/**
 * Elimina el perfil de un usuario de la base de datos y de Firebase.
 * Requiere autenticación reciente.
 */
export const deleteUser = async (req, res) => {
  const { uid, auth_time: authTime } = req.user; // auth_time viene del token decodificado
  const dbg = (...args) => console.log('[deleteUser]', ...args);
  dbg(`Solicitud de eliminación para el usuario: ${uid}`);

  // 1. Comprobar autenticación reciente (ej. últimos 5 minutos)
  const fiveMinutesInSeconds = 5 * 60;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const tokenAgeInSeconds = nowInSeconds - authTime;

  if (tokenAgeInSeconds > fiveMinutesInSeconds) {
    dbg(`Fallo de autenticación reciente. Token age: ${tokenAgeInSeconds}s`);
    return res.status(401).json({
      success: false,
      message: 'La sesión ha expirado. Por favor, inicie sesión de nuevo para continuar.',
      code: 'RECENT_LOGIN_REQUIRED',
    });
  }
  dbg('Autenticación reciente verificada.');

  try {
    // 2. Eliminar al usuario de Firebase Authentication
    dbg(`Iniciando borrado en Firebase Auth para UID: ${uid}`);
    const auth = getAuth();
    await auth.deleteUser(uid);
    dbg(`Usuario ${uid} eliminado de Firebase Authentication.`);

    // 3. Si el borrado en Firebase fue exitoso, eliminar de la BD local
    // Gracias a ON DELETE CASCADE, se borrarán todas las referencias.
    dbg(`Iniciando borrado en BD para user_id: ${uid}`);
    await prisma.user.delete({
      where: { user_id: uid },
    });
    dbg(`Usuario ${uid} eliminado de la base de datos.`);

    // 4. Enviar respuesta de éxito
    return res.status(200).json({
      success: true,
      message: 'Tu cuenta ha sido eliminada permanentemente.',
    });
  } catch (error) {
    // Manejo de errores
    // Error de Firebase: el usuario no existe, etc.
    if (error.code?.startsWith('auth/')) {
      console.error(`Error de Firebase al intentar eliminar al usuario ${uid}:`, error);
      // Si el usuario no se encuentra en Firebase, puede que ya haya sido eliminado.
      // Podríamos continuar para asegurarnos de que se borre de nuestra BD,
      // pero por seguridad es mejor detenerse y registrar el error.
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error con el servicio de autenticación al intentar eliminar tu cuenta.',
        code: 'FIREBASE_ERROR',
      });
    }

    // Error de Prisma: el registro a eliminar no existe.
    if (error.code === 'P2025') {
      // Esto es inesperado si el borrado de Firebase tuvo éxito.
      // Lo registramos como un problema de inconsistencia.
      console.error(`[CRITICAL] Inconsistencia: el usuario ${uid} fue borrado de Firebase pero no se encontró en la BD local.`);
      return res.status(404).json({
        success: false,
        message: 'El usuario no fue encontrado en nuestra base de datos.',
        code: 'USER_NOT_FOUND_IN_DB',
      });
    }

    console.error(`Error inesperado al eliminar al usuario ${uid}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Ocurrió un error al intentar eliminar tu cuenta.',
    });
  }
};

/**
 * Obtiene el perfil del usuario autenticado a través del JWT del backend.
 */
export const getUserProfile = async (req, res) => {
  // El UID del usuario viene del payload del JWT verificado por el middleware
  const { uid } = req.user;

  try {
    const userProfile = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      select: {
        user_id: true,
        email: true,
        name: true,
        surname: true,
        username: true,
        dni: true,
        app_language: true,
        client: {
          select: {
            profile_picture: true,
            address: true,
            phone: true,
            birth_date: true,
            description: true,
            points: true,
            streak: true,
          },
        },
        admin: true,
        institution: true,
      },
    });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Determinar el rol
    let role = 'client';
    if (userProfile.admin) role = 'admin';
    if (userProfile.institution) role = 'institution';

    // Formatear la respuesta para que coincida con el contrato de la API
    const responseData = {
      uid: userProfile.user_id,
      email: userProfile.email,
      name: userProfile.name,
      surname: userProfile.surname,
      username: userProfile.username,
      dni: userProfile.dni,
      profile_picture: userProfile.client?.profile_picture || null,
      app_language: userProfile.app_language,
      address: userProfile.client?.address || null,
      phone: userProfile.client?.phone || null,
      birth_date: userProfile.client?.birth_date ? userProfile.client.birth_date.toISOString().split('T')[0] : null,
      description: userProfile.client?.description || null,
      role,
      points: userProfile.client?.points || 0,
      streak: userProfile.client?.streak || 0,
    };

    return res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      data: responseData,
    });
  } catch (error) {
    console.error('[getUserProfile] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil del usuario.',
      code: 'GET_PROFILE_ERROR',
    });
  }
};
