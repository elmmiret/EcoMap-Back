// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { prisma } from '#lib/prisma.js';
import { signUserJWT } from '#lib/jwt.js';
import { getAuth } from '#services/auth.service.js';
import { uploadToS3, deleteFromS3 } from '#services/storage.service.js';

// Debug helper to keep logs consistent
const dbg = (...args) => console.log('[syncUserToPostgres]', ...args);

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 * Distingue entre registro manual (con datos en el body) y social (datos de Firebase).
 * Crea: user -> registered_user -> client
 */
export const syncUserToPostgres = async (req, res) => {
  const { uid: firebaseUID } = req.user;

  const { role: requestRole } = req.body;
  const validRoles = ['client', 'admin', 'institution'];
  const roleToAssign = validRoles.includes(requestRole) ? requestRole : 'client';

  dbg('Inicio handler', { firebaseUID, bodyKeys: Object.keys(req.body || {}) });

  try {
    // Primero verificar si el usuario está bloqueado
    const userBlockStatus = await prisma.user.findUnique({
      where: { user_id: firebaseUID },
      select: { blocked: true },
    });

    if (userBlockStatus && userBlockStatus.blocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    // lógica de login
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

      // Limpiar TODAS las sesiones anteriores de este usuario
      const { count: deletedCount } = await prisma.session.deleteMany({
        where: {
          user_id: firebaseUID,
        },
      });
      if (deletedCount > 0) {
        dbg('Sesiones anteriores eliminadas', { count: deletedCount });
      }

      // Determinar el rol del usuario
      let currentRole = 'client';
      if (existingUser.admin) currentRole = 'admin';
      else if (existingUser.institution) currentRole = 'institution';

      // Generar y guardar nuevo JWT
      const jwtPayload = {
        uid: existingUser.user_id,
        email: existingUser.email,
        name: existingUser.name,
        surname: existingUser.surname,
        username: existingUser.username || null,
        profile_picture: existingUser.profile_picture || null,
        role: currentRole,
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
        role: currentRole,
      });
    }

    // --- 2. Si no existe, es un REGISTRO ---
    dbg('Usuario no existe -> REGISTRO');

    let s3profilePictureUrl = null;
    if (req.file) {
      try {
        s3profilePictureUrl = await uploadToS3(req.file);
        dbg('Imagen subida a S3exitosamente:', s3profilePictureUrl);
      } catch (uploadError) {
        console.error('Error subiendo imagen a S3:', uploadError);
      }
    }

    const { name: bodyName, email: bodyEmail, username: bodyUsername } = req.body;
    const isManualRegistration = !!(bodyName && bodyEmail); // Username es opcional

    let userData = {
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
      userData.profile_picture = s3profilePictureUrl;
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
      userData.profile_picture = s3profilePictureUrl || userRecord.photoURL || null;

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

    const { registeredUser } = await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { user_id: userData.uid } });
      dbg('Fila creada en tabla `user`');

      const newRegisteredUser = await tx.registered_user.create({
        data: {
          user_id: userData.uid,
          name: userData.name,
          email: userData.email,
          app_language: 'es', // Valor por defecto
          profile_picture: userData.profile_picture,
          ...(userData.surname && { surname: userData.surname }),
          ...(userData.username && { username: userData.username }),
        },
      });
      dbg('Fila creada en tabla `registered_user`');

      switch (roleToAssign) {
        case 'admin':
          await tx.admin.create({
            data: { user_id: userData.uid },
          });
          break;

        case 'institution':
          await tx.institution.create({
            data: { user_id: userData.uid },
          });
          break;

        case 'client':
          await tx.client.create({
            data: {
              user_id: userData.uid,
              points: 0,
              streak: 0,
              ...(userData.phone && { phone: userData.phone }),
            },
          });
          break;
      }

      return { registeredUser: newRegisteredUser };
    });

    dbg('Transacción de creación completada');

    // --- 4. Generar y devolver JWT para el nuevo usuario ---
    const jwtPayload = {
      uid: registeredUser.user_id,
      email: registeredUser.email,
      name: registeredUser.name,
      surname: registeredUser.surname,
      username: registeredUser.username || null,
      role: roleToAssign,
      profile_picture: registeredUser.profile_picture || null,
      points: roleToAssign === 'client' ? 0 : 0,
      streak: roleToAssign === 'client' ? 0 : 0,
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
      message: `Usuario registrado como ${roleToAssign} correctamente.`,
      jwt: token,
      expiryDate: expiryDate.toISOString(),
      role: roleToAssign,
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
      // Determinar qué campo causó el conflicto
      const target = error.meta?.target;

      if (target?.includes('username')) {
        return res.status(409).json({
          success: false,
          message: 'El nombre de usuario ya está en uso.',
          code: 'USERNAME_TAKEN',
        });
      }

      if (target?.includes('email')) {
        return res.status(409).json({
          success: false,
          message: 'El email ya está registrado.',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }

      // Fallback genérico si no se puede determinar el campo
      return res.status(409).json({
        success: false,
        message: 'El email o nombre de usuario ya existe.',
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

  // UID del usuario autenticado
  const { uid } = req.user;
  const { newLanguage } = req.body;

  if (!newLanguage || typeof newLanguage !== 'string' || newLanguage.length < 2) {
    dbg('Validación fallida: newLanguage no válido');
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar un idioma válido en el campo "newLanguage" del cuerpo de la solicitud.',
      code: 'INVALID_LANGUAGE',
    });
  }

  try {
    // Actualizar el campo app_language en la base de datos
    const updatedUser = await prisma.registered_user.update({
      where: { user_id: uid },
      data: { app_language: newLanguage },
    });

    dbg(`Idioma actualizado a ${updatedUser.app_language} en la BD.`);

    return res.status(200).json({
      success: true,
      message: `Idioma de la aplicación cambiado a ${updatedUser.app_language}.`,
      newLanguage: updatedUser.app_language,
    });
  } catch (error) {
    console.error('Error en changeAppLanguage:', error);

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
    // Buscamos la URL de la imagen antes de que el usuario sea borrado
    const userToDelete = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      select: { profile_picture: true },
    });

    if (userToDelete?.profile_picture) {
      dbg(`Imagen de perfil encontrada, eliminando de S3: ${userToDelete.profile_picture}`);
      try {
        await deleteFromS3(userToDelete.profile_picture);
      } catch (s3Error) {
        console.error('Error al borrar imagen de S3, continuando con eliminación de cuenta:', s3Error);
      }
    }

    // Eliminar al usuario de Firebase Authentication
    dbg(`Iniciando borrado en Firebase Auth para UID: ${uid}`);
    const auth = getAuth();
    await auth.deleteUser(uid);
    dbg(`Usuario ${uid} eliminado de Firebase Authentication.`);

    // Si el borrado en Firebase fue exitoso, eliminar de la BD local
    // Gracias a ON DELETE CASCADE, se borrarán todas las referencias.
    dbg(`Iniciando borrado en BD para user_id: ${uid}`);
    await prisma.user.delete({
      where: { user_id: uid },
    });
    dbg(`Usuario ${uid} eliminado de la base de datos.`);

    // Enviar respuesta de éxito
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
 * Obtiene TODA la información del perfil de un usuario específico por su ID.
 * Combina datos de registered_user con los datos de su rol específico (client, admin, etc.)
 * Endpoint: GET /api/users/:userId
 */
export const getUserFullProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.registered_user.findUnique({
      where: { user_id: userId },
      include: {
        client: true,
        admin: true,
        institution: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    // determinar el rol y extraer los datos específicos
    let role = 'client'; // por defecto
    let roleData = {};

    if (user.admin) {
      role = 'admin';
      roleData = user.admin;
    } else if (user.institution) {
      role = 'institution';
      roleData = user.institution;
    } else if (user.client) {
      role = 'client';
      roleData = user.client;
    }

    // limpiar el objeto de respuesta
    // eliminamos las propiedades anidadas redundantes para enviar un objeto plano
    // eslint-disable-next-line no-unused-vars
    const { client, admin, institution, ...baseUserData } = user;

    const fullProfile = {
      ...baseUserData,
      role: role,
      ...roleData,
    };

    return res.status(200).json({
      success: true,
      message: 'Perfil de usuario recuperado exitosamente.',
      data: fullProfile,
    });
  } catch (error) {
    console.error(`Error obteniendo perfil completo del usuario ${userId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el usuario.',
      code: 'GET_USER_ERROR',
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
            address: true,
            phone: true,
            birth_date: true,
            description: true,
            points: true,
            streak: true,
            valorations_score: true,
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
    let role = '';
    if (userProfile.client) role = 'client';
    else if (userProfile.admin) role = 'admin';
    else if (userProfile.institution) role = 'institution';

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
      valorations_score: userProfile.client?.valorations_score || 0,
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

/**
 * @route PUT /api/users/me
 * @description Actualiza el perfil del usuario autenticado.
 * Soporta actualización de imagen (borrando la anterior) y datos de texto.
 */
export const updateUserProfile = async (req, res) => {
  const { uid } = req.user;
  const dbg = (...args) => console.log('[updateUserProfile]', ...args);
  dbg(`Solicitud de actualización de perfil para usuario: ${uid}`);

  // Extraer campos del body
  const { name, surname, username, address, email, dni, phone, birth_date, description } = req.body;

  // --- Validaciones críticas y preparación de datos ---
  const errors = [];
  const registeredUserData = {};
  const clientData = {};

  // lógica de imágen
  if (req.file) {
    try {
      dbg('Procesando nueva imagen de perfil...');
      // Buscar el usuario actual para obtener la URL de la imagen VIEJA
      const currentUser = await prisma.registered_user.findUnique({
        where: { user_id: uid },
        select: { profile_picture: true },
      });

      // Si tenía foto anterior, borrarla de S3
      if (currentUser?.profile_picture) {
        await deleteFromS3(currentUser.profile_picture);
        dbg('Imagen antigua eliminada de S3');
      }

      // Subir la nueva imagen y guardar la URL
      const newImageUrl = await uploadToS3(req.file);
      registeredUserData.profile_picture = newImageUrl;
      dbg('Nueva imagen subida:', newImageUrl);
    } catch (err) {
      console.error('Error gestionando imagen en update:', err);
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la imagen de perfil.',
        code: 'IMAGE_PROCESSING_ERROR',
      });
    }
  }

  // validaciones de texto
  // name
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) {
      errors.push({ field: 'name', message: 'El campo "name" debe ser un texto válido de máximo 80 caracteres.' });
    } else {
      registeredUserData.name = name.trim();
    }
  }

  // surname
  if (surname !== undefined && surname !== null) {
    if (typeof surname !== 'string' || surname.length > 80) {
      errors.push({ field: 'surname', message: 'El campo "surname" debe tener máximo 80 caracteres.' });
    } else {
      registeredUserData.surname = surname.trim();
    }
  }

  registeredUserData.email = email || registeredUserData.email;
  registeredUserData.dni = dni || registeredUserData.dni;
  //clientData.address = address || clientData.address;
  //clientData.phone = phone || clientData.phone;
  //clientData.description = description || clientData.description;

  // username
  if (username !== undefined && username !== null) {
    if (typeof username !== 'string' || username.trim().length === 0 || username.length > 30) {
      errors.push({ field: 'username', message: 'El campo "username" debe tener máximo 30 caracteres.' });
    } else if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      errors.push({ field: 'username', message: 'El campo "username" solo puede contener letras, números, puntos y guiones bajos.' });
    } else {
      registeredUserData.username = username.trim();
    }
  }

  // address
  if (address !== undefined && address !== null) {
    if (typeof address !== 'string' || address.length > 200) {
      errors.push({ field: 'address', message: 'El campo "address" debe tener máximo 200 caracteres.' });
    } else {
      clientData.address = address.trim();
    }
  }

  // phone
  if (phone !== undefined && phone !== null) clientData.phone = phone;

  // birth_date
  if (birth_date !== undefined && birth_date !== null) {
    if (typeof birth_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      errors.push({ field: 'birth_date', message: 'El campo "birth_date" debe estar en formato YYYY-MM-DD.' });
    } else {
      const parsedDate = new Date(birth_date);
      if (isNaN(parsedDate.getTime())) {
        errors.push({ field: 'birth_date', message: 'El campo "birth_date" no es una fecha válida.' });
      } else if (parsedDate > new Date()) {
        errors.push({ field: 'birth_date', message: 'El campo "birth_date" no puede ser una fecha futura.' });
      } else {
        clientData.birth_date = parsedDate;
      }
    }
  }

  // description
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > 1000) {
      errors.push({ field: 'description', message: 'El campo "description" debe tener máximo 1000 caracteres.' });
    } else {
      clientData.description = description.trim();
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación en los campos enviados.',
      code: 'VALIDATION_ERROR',
      errors,
    });
  }

  try {
    const hasUpdates = Object.keys(registeredUserData).length > 0 || Object.keys(clientData).length > 0;
    let responseMessage = 'Perfil sin cambios';

    // actualizamos
    if (hasUpdates) {
      dbg('Datos a actualizar:', { registeredUserData, clientData });

      await prisma.$transaction(async (tx) => {
        if (Object.keys(registeredUserData).length > 0) {
          await tx.registered_user.update({
            where: { user_id: uid },
            data: registeredUserData,
          });
        }
        if (Object.keys(clientData).length > 0) {
          await tx.client.update({
            where: { user_id: uid },
            data: clientData,
          });
        }
      });

      responseMessage = 'Perfil actualizado correctamente';
      dbg('Transacción completada con éxito');
    } else {
      dbg('No hay campos para actualizar, se devolverá el perfil actual.');
    }

    // obtenemos el perfil unificado
    const userProfile = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      select: {
        user_id: true,
        email: true,
        name: true,
        surname: true,
        username: true,
        dni: true,
        profile_picture: true,
        app_language: true,
        client: {
          select: {
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

    let role = 'client';
    if (userProfile.admin) role = 'admin';
    if (userProfile.institution) role = 'institution';

    const responseData = {
      uid: userProfile.user_id,
      email: userProfile.email,
      name: userProfile.name,
      surname: userProfile.surname,
      username: userProfile.username,
      dni: userProfile.dni,
      profile_picture: userProfile.profile_picture || null,
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
      message: responseMessage, // Mensaje dinámico según si hubo cambios o no
      data: responseData,
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);

    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return res.status(409).json({
        success: false,
        message: 'El nombre de usuario ya está en uso.',
        code: 'USERNAME_TAKEN',
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el perfil.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Obtiene los IDs de TODOS los usuarios registrados.
 */
export const getAllUserIds = async (req, res) => {
  try {
    const users = await prisma.registered_user.findMany({
      select: {
        user_id: true,
      },
    });

    const ids = users.map((u) => u.user_id);

    return res.status(200).json({
      success: true,
      count: ids.length,
      ids,
    });
  } catch (error) {
    console.error('Error getting all user IDs:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener IDs de usuarios' });
  }
};

/**
 * Obtiene los IDs solo de los CLIENTES.
 */
export const getAllClientIds = async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      select: { user_id: true },
    });
    const ids = clients.map((c) => c.user_id);
    return res.status(200).json({ success: true, count: ids.length, ids });
  } catch (error) {
    console.error('Error getting client IDs:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener IDs de clientes' });
  }
};

/**
 * Obtiene los IDs solo de las INSTITUCIONES.
 */
export const getAllInstitutionIds = async (req, res) => {
  try {
    const institutions = await prisma.institution.findMany({
      select: { user_id: true },
    });
    const ids = institutions.map((i) => i.user_id);
    return res.status(200).json({ success: true, count: ids.length, ids });
  } catch (error) {
    console.error('Error getting institution IDs:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener IDs de instituciones' });
  }
};

/**
 * Obtiene los IDs solo de los ADMINISTRADORES.
 */
export const getAllAdminIds = async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: { user_id: true },
    });
    const ids = admins.map((a) => a.user_id);
    return res.status(200).json({ success: true, count: ids.length, ids });
  } catch (error) {
    console.error('Error getting admin IDs:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener IDs de administradores' });
  }
};

/**
 * Obtiene el tipo de usuario (rol) por su ID.
 * Endpoint: GET /api/users/:id/type
 */
export const getUserTypeById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.registered_user.findUnique({
      where: { user_id: id },
      select: {
        client: { select: { user_id: true } },
        institution: { select: { user_id: true } },
        admin: { select: { user_id: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    let role = 'unknown';
    if (user.admin) role = 'admin';
    else if (user.institution) role = 'institution';
    else if (user.client) role = 'client';

    return res.status(200).json({
      success: true,
      message: 'Tipo de usuario obtenido correctamente.',
      role: role, // "client", "institution", "admin"
    });
  } catch (error) {
    console.error('Error al obtener el tipo de usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Obtiene datos públicos de un usuario.
 * Excluye: email, dni, telefono, dirección, fecha nacimiento.
 * Endpoint: GET /api/users/:id/public
 */
export const getUserPublicData = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.registered_user.findUnique({
      where: { user_id: id },
      select: {
        // Solo seleccionamos campos NO sensibles
        user_id: true,
        username: true,
        name: true,
        surname: true,
        app_language: true,
        // Datos públicos del cliente
        client: {
          select: {
            description: true,
            points: true,
            streak: true,
          },
        },
        // Solo verificamos existencia para el rol, no sacamos datos internos
        admin: { select: { user_id: true } },
        institution: { select: { user_id: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Determinar rol
    let role = 'client';
    if (user.admin) role = 'admin';
    else if (user.institution) role = 'institution';

    // Construir objeto de respuesta limpia
    const publicData = {
      uid: user.user_id,
      username: user.username,
      name: user.name,
      surname: user.surname,
      role: role,
      profile_picture: user.client?.profile_picture || null,
      description: user.client?.description || null,
      points: user.client?.points || 0,
      streak: user.client?.streak || 0,
      app_language: user.app_language,
    };

    return res.status(200).json({
      success: true,
      message: 'Datos públicos obtenidos correctamente.',
      data: publicData,
    });
  } catch (error) {
    console.error('[getUserPublicData] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener datos públicos.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Obtiene solo datos confidenciales un usuario.
 * Devuelve exclusivamente: email, dni, telefono, dirección, fecha nacimiento.
 * Endpoint: GET /api/users/:id/private
 */
export const getUserPrivateData = async (req, res) => {
  const { id } = req.params;

  // Verificación de seguridad recomendada:
  // Solo permitir si el usuario es Admin o si es el mismo usuario que consulta sus datos.
  if (req.user.uid !== id) {
    // Aquí podrías añadir lógica para verificar si req.user.uid es admin si deseas permitir admins
    return res.status(403).json({
      success: false,
      message: 'No tienes permiso para ver los datos confidenciales de este usuario.',
      code: 'FORBIDDEN_ACCESS',
    });
  }

  try {
    const user = await prisma.registered_user.findUnique({
      where: { user_id: id },
      select: {
        email: true,
        dni: true,
        client: {
          select: {
            phone: true,
            address: true,
            birth_date: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Construir respuesta solo con datos sensibles
    const sensitiveData = {
      email: user.email,
      dni: user.dni,
      phone: user.client?.phone || null,
      address: user.client?.address || null,
      birth_date: user.client?.birth_date ? user.client.birth_date.toISOString().split('T')[0] : null,
    };

    return res.status(200).json({
      success: true,
      message: 'Datos confidenciales obtenidos correctamente.',
      data: sensitiveData,
    });
  } catch (error) {
    console.error('[getUserPrivateData] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener datos privados.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Obtiene las valoraciones que un usuario ha escrito.
 * Endpoint: GET /api/users/:id/valorations/made
 */
export const getUserValorationsMade = async (req, res) => {
  const { id } = req.params;

  try {
    const valorations = await prisma.valoration.findMany({
      where: { valoration_owner: id },
      include: {
        target: {
          // Incluimos datos de a quién valoró
          include: { registered_user: { select: { username: true, name: true } } },
        },
        reservation_ended: {
          // Incluimos contexto (qué trade fue)
          include: {
            reservation: {
              include: { trade: { include: { publication: { select: { title: true } } } } },
            },
          },
        },
      },
      orderBy: { reservation_ended: { ended_at: 'desc' } }, // Ordenar por fecha
    });

    return res.status(200).json({
      success: true,
      count: valorations.length,
      data: valorations,
    });
  } catch (error) {
    console.error('Error obteniendo valoraciones hechas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene las valoraciones que un usuario ha recibido.
 * Endpoint: GET /api/users/:id/valorations/received
 */
export const getUserValorationsReceived = async (req, res) => {
  const { id } = req.params;

  try {
    const valorations = await prisma.valoration.findMany({
      where: { valoration_target: id },
      include: {
        author: {
          // Incluimos quién escribió la reseña
          include: {
            registered_user: { select: { username: true, name: true } },
          },
        },
        reservation_ended: {
          include: {
            reservation: {
              include: { trade: { include: { publication: { select: { title: true } } } } },
            },
          },
        },
      },
      orderBy: { reservation_ended: { ended_at: 'desc' } },
    });

    // Cálculo opcional de la media
    const averageScore = valorations.length > 0 ? valorations.reduce((acc, curr) => acc + curr.score, 0) / valorations.length : 0;

    return res.status(200).json({
      success: true,
      count: valorations.length,
      average_score: parseFloat(averageScore.toFixed(1)), // Ej: 4.5
      data: valorations,
    });
  } catch (error) {
    console.error('Error obteniendo valoraciones recibidas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene el valorations_score (puntuación media) de un usuario cliente.
 * Endpoint: GET /api/users/:id/score
 */
export const getUserScore = async (req, res) => {
  const { id } = req.params;

  try {
    const client = await prisma.client.findUnique({
      where: { user_id: id },
      select: { valorations_score: true },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado o el usuario no tiene perfil de cliente.',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Puntuación obtenida correctamente.',
      score: client.valorations_score,
    });
  } catch (error) {
    console.error(`Error obteniendo score del usuario ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener la puntuación.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Obtiene todos los rewards comprados por el usuario actual (token).
 * Endpoint: GET /api/users/me/rewards_bought
 */
export const getMyRewardsBought = async (req, res) => {
  const { uid } = req.user;

  try {
    const rewards = await prisma.reward_bought_by.findMany({
      where: { client_id: uid },
      include: {
        reward: {
          include: {
            publication: {
              include: {
                publication_media: true,
                institution: {
                  select: { registered_user: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { bought_at: 'desc' },
    });

    const formattedData = rewards.map((item) => ({
      purchase_id: item.id,
      bought_at: item.bought_at,
      points_cost: item.points_cost,
      reward: {
        id: item.reward.publication_id,
        title: item.reward.publication.title,
        description: item.reward.publication.description,
        image: item.reward.publication.publication_media?.media_url || null,
        institution_name: item.reward.publication.institution?.registered_user?.name || 'Institución Desconocida',
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error('Error obteniendo mis rewards comprados:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene todos los rewards comprados por un usuario específico (por ID).
 * Endpoint: GET /api/users/:userId/rewards_bought
 */
export const getUserRewardsBoughtById = async (req, res) => {
  // Nota: Usamos 'id' si definiste la ruta como /:id/..., o 'userId' si fue /:userId/...
  // Para mantener consistencia con tus otras rutas de usuario, usaré el parámetro que definas en routes.
  const { userId } = req.params;

  try {
    // Verificar si el usuario existe (opcional, pero recomendado)
    const userExists = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!userExists) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const rewards = await prisma.reward_bought_by.findMany({
      where: { client_id: userId },
      include: {
        reward: {
          include: {
            publication: {
              include: {
                publication_media: true,
                institution: {
                  select: { registered_user: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { bought_at: 'desc' },
    });

    const formattedData = rewards.map((item) => ({
      purchase_id: item.id,
      bought_at: item.bought_at,
      points_cost: item.points_cost,
      reward: {
        id: item.reward.publication_id,
        title: item.reward.publication.title,
        description: item.reward.publication.description,
        image: item.reward.publication.publication_media?.media_url || null,
        institution_name: item.reward.publication.institution?.registered_user?.name || 'Institución Desconocida',
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error(`Error obteniendo rewards del usuario ${userId}:`, error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene la cantidad de puntos de un usuario cliente específico.
 * Endpoint: GET /api/users/:userId/points
 */
export const getUserPoints = async (req, res) => {
  const { userId } = req.params;

  try {
    const client = await prisma.client.findUnique({
      where: { user_id: userId },
      select: { points: true },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no existe o no tiene un perfil de cliente (no tiene puntos).',
        code: 'CLIENT_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      points: client.points,
    });
  } catch (error) {
    console.error(`Error obteniendo puntos del usuario ${userId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener los puntos.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Bloquea a un usuario añadiendo su ID al vector blocked_users.
 * Endpoint: POST /api/users/block/:userId
 */
export const addUserToBlockedList = async (req, res) => {
  const { uid } = req.user; // El que bloquea
  const { userId } = req.params; // El usuario a bloquear

  if (uid === userId) {
    return res.status(400).json({ success: false, message: 'No puedes bloquearte a ti mismo.' });
  }

  try {
    // verificar si el usuario a bloquear existe
    const targetUser = await prisma.registered_user.findUnique({
      where: { user_id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'El usuario a bloquear no existe.' });
    }

    // actualizar el usuario actual añadiendo el ID al array (si no está ya)

    // primero obtenemos el usuario actual para no duplicar IDs
    const currentUser = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      select: { blocked_users: true },
    });

    if (currentUser.blocked_users.includes(userId)) {
      return res.status(409).json({ success: false, message: 'Ya has bloqueado a este usuario.' });
    }

    await prisma.registered_user.update({
      where: { user_id: uid },
      data: {
        blocked_users: {
          push: userId, // añadir el ID al array
        },
      },
    });

    return res.status(200).json({ success: true, message: 'Usuario bloqueado correctamente.' });
  } catch (error) {
    console.error('Error al bloquear usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene la lista de usuarios bloqueados por un usuario específico.
 * Solo para administradores.
 * Endpoint: GET /api/users/admin/block/:userId
 */
export const getUserBlockedList = async (req, res) => {
  const { uid } = req.user; // id del admin
  const { userId } = req.params; // id del client

  try {
    // verificar si el solicitante es admin
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo los administradores pueden ver esta información.',
        code: 'FORBIDDEN_ADMIN_ONLY',
      });
    }

    // buscar al usuario objetivo y obtener su array de bloqueados
    const targetUser = await prisma.registered_user.findUnique({
      where: { user_id: userId },
      select: { blocked_users: true },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'El usuario especificado no existe.',
        code: 'USER_NOT_FOUND',
      });
    }

    // devolver la lista
    return res.status(200).json({
      success: true,
      message: `Lista de bloqueos del usuario ${userId} recuperada.`,
      blocked_users: targetUser.blocked_users || [], // Devuelve array de IDs
    });
  } catch (error) {
    console.error(`Error obteniendo bloqueos del usuario ${userId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Reporta a un usuario.
 * Endpoint: POST /api/users/report/:userId
 */
export const reportUser = async (req, res) => {
  const { uid: reporterId } = req.user;
  const { userId: reportedUserId } = req.params;
  const { reason, description } = req.body;

  // validar que no se reporte a sí mismo
  if (reporterId === reportedUserId) {
    return res.status(400).json({ success: false, message: 'No puedes reportarte a ti mismo.' });
  }

  // validar motivo
  const validReasons = ['inappropriate_content', 'harassment', 'fake_profile', 'spam', 'other'];
  if (!reason || !validReasons.includes(reason)) {
    return res.status(400).json({ success: false, message: 'Motivo de reporte inválido o faltante.' });
  }

  // si es "other", la descripción es obligatoria
  if (reason === 'other') {
    if (!description || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Si seleccionas "Otro", debes proporcionar una descripción.',
        code: 'MISSING_DESCRIPTION_FOR_OTHER',
      });
    }
  }

  try {
    // verificar existencia del usuario reportado
    const targetUser = await prisma.registered_user.findUnique({
      where: { user_id: reportedUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'El usuario a reportar no existe.' });
    }

    // crear el reporte
    const newReport = await prisma.user_report.create({
      data: {
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason: reason,
        description: description || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Usuario reportado correctamente. Los administradores revisarán el caso.',
      data: newReport,
    });
  } catch (error) {
    console.error('Error al reportar usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar el reporte.' });
  }
};

/**
 * Obtiene todos los reportes, solo para admins
 * Endpoint: GET /api/users/admin/reports
 */
export const getAllUserReports = async (req, res) => {
  const { uid } = req.user;

  try {
    // verificar si el solicitante es admin
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    // obtener reportes con información detallada
    const reports = await prisma.user_report.findMany({
      include: {
        reporter: {
          select: { username: true, email: true },
        },
        reported_user: {
          select: {
            user_id: true,
            username: true,
            email: true,
            profile_picture: true,
            blocked_users: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Error obteniendo reportes:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Actualiza el estado de un reporte.
 * Solo para administradores.
 * El nuevo estado debe ser diferente al actual.
 * Endpoint: PATCH /api/users/admin/reports/:reportId
 */
export const updateReportStatus = async (req, res) => {
  const { uid } = req.user;
  const { reportId } = req.params;
  const { status } = req.body;

  // validar que el estado sea válido según el Enum de Prisma
  const validStatuses = ['Pending', 'Resolved', 'Dismissed'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}.`,
      code: 'INVALID_STATUS',
    });
  }

  try {
    // verificar permisos de admin
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden gestionar reportes.',
        code: 'FORBIDDEN_ADMIN_ONLY',
      });
    }

    // buscar el reporte existente
    const currentReport = await prisma.user_report.findUnique({
      where: { report_id: reportId },
    });

    if (!currentReport) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado.',
        code: 'REPORT_NOT_FOUND',
      });
    }

    // validar que el estado sea diferente
    if (currentReport.status === status) {
      return res.status(409).json({
        success: false,
        message: 'El nuevo estado debe ser diferente al actual.',
        code: 'SAME_STATUS_ERROR',
      });
    }

    // actualizar el reporte
    const updatedReport = await prisma.user_report.update({
      where: { report_id: reportId },
      data: { status: status },
    });

    return res.status(200).json({
      success: true,
      message: `Estado del reporte actualizado a ${status}.`,
      data: updatedReport,
    });
  } catch (error) {
    console.error('Error actualizando estado del reporte:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Elimina un reporte específico.
 * Solo para administradores.
 * Endpoint: DELETE /api/users/admin/reports/:reportId
 */
export const deleteReport = async (req, res) => {
  const { uid } = req.user;
  const { reportId } = req.params;

  try {
    // verificar permisos de ADMIN
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden eliminar reportes.',
        code: 'FORBIDDEN_ADMIN_ONLY',
      });
    }

    // verificar existencia del reporte
    const report = await prisma.user_report.findUnique({
      where: { report_id: reportId },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado.',
        code: 'REPORT_NOT_FOUND',
      });
    }

    // eliminar reporte
    await prisma.user_report.delete({
      where: { report_id: reportId },
    });

    return res.status(200).json({
      success: true,
      message: 'Reporte eliminado correctamente.',
    });
  } catch (error) {
    console.error('Error eliminando reporte:', error);
    return res.status(500).json({ success: false, message: 'Error interno al eliminar el reporte.' });
  }
};

/**
 * Obtiene reportes filtrados por su estado.
 * Estados válidos: Pending, Resolved, Dismissed.
 * Endpoint: GET /api/users/admin/reports/status/:status
 */
export const getReportsByStatus = async (req, res) => {
  const { uid } = req.user;
  const { status } = req.params;

  try {
    // verificar si es admin
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo administradores.' });
    }

    // normalizar el estado (Primera mayúscula, resto minúscula)
    const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    // validar que sea un estado permitido en el Enum
    const validStatuses = ['Pending', 'Resolved', 'Dismissed'];
    if (!validStatuses.includes(formattedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Usa: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS_PARAM',
      });
    }

    // buscar reportes
    const reports = await prisma.user_report.findMany({
      where: { status: formattedStatus },
      include: {
        reporter: {
          select: { username: true, email: true },
        },
        reported_user: {
          select: {
            user_id: true,
            username: true,
            email: true,
            profile_picture: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      success: true,
      status: formattedStatus,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Error obteniendo reportes por estado:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene el detalle completo de un reporte por su ID.
 * Endpoint: GET /api/users/admin/reports/detail/:reportId
 */
export const getReportById = async (req, res) => {
  const { uid } = req.user;
  const { reportId } = req.params;

  try {
    // verificar ADMIN
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso denegado.' });
    }

    // buscar Reporte con todos los detalles
    const report = await prisma.user_report.findUnique({
      where: { report_id: reportId },
      include: {
        reporter: {
          select: {
            user_id: true,
            username: true,
            name: true,
            email: true,
            profile_picture: true,
          },
        },
        reported_user: {
          select: {
            user_id: true,
            username: true,
            name: true,
            email: true,
            profile_picture: true,
            blocked_users: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Reporte no encontrado.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Detalle del reporte obtenido.',
      data: report,
    });
  } catch (error) {
    console.error('Error obteniendo detalle del reporte:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Admin: Create new user (client or institution)
 * This creates a user in Firebase Auth and then syncs to PostgreSQL
 */
export const createUserByAdmin = async (req, res) => {
  const { email, name, username, role } = req.body;

  if (!email || !name || !role) {
    return res.status(400).json({
      success: false,
      message: 'Email, nombre y rol son obligatorios.',
    });
  }

  if (!['client', 'institution'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'El rol debe ser "client" o "institution".',
    });
  }

  try {
    const auth = getAuth();

    // Check if user already exists in PostgreSQL
    const existingUser = await prisma.registered_user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un usuario con ese email en la base de datos.',
      });
    }

    // Generate a random temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';

    // Create user in Firebase with retry logic
    let userRecord;
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        userRecord = await auth.createUser({
          email,
          password: tempPassword,
          displayName: name,
          emailVerified: false,
        });
        console.log('Usuario creado en Firebase:', userRecord.uid);
        break; // Success, exit retry loop
      } catch (firebaseError) {
        lastError = firebaseError;
        console.error(`Error en Firebase (intentos restantes: ${retries - 1}):`, firebaseError.code);

        if (firebaseError.code === 'auth/email-already-exists') {
          return res.status(409).json({
            success: false,
            message: 'Ya existe un usuario con ese email en Firebase.',
          });
        }

        // If it's a network error, retry
        if (
          firebaseError.code === 'app/network-timeout' ||
          firebaseError.message?.includes('getaddrinfo') ||
          firebaseError.message?.includes('ENOTFOUND') ||
          firebaseError.message?.includes('EAI_AGAIN')
        ) {
          retries--;
          if (retries > 0) {
            console.log('Error de red detectado, reintentando en 2 segundos...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
        }

        throw firebaseError;
      }
    }

    if (!userRecord) {
      throw lastError || new Error('No se pudo crear el usuario en Firebase después de reintentar');
    }

    // Create user in PostgreSQL
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // First, create the base user entry
    await prisma.user.create({
      data: {
        user_id: userRecord.uid,
      },
    });

    // Then create the registered_user entry
    await prisma.registered_user.create({
      data: {
        user_id: userRecord.uid,
        email,
        name: firstName,
        surname: lastName,
        username: username || email.split('@')[0],
        app_language: 'es',
      },
    });

    // Create role-specific entry
    if (role === 'client') {
      await prisma.client.create({
        data: {
          user_id: userRecord.uid,
          points: 0,
          streak: 0,
        },
      });
    } else if (role === 'institution') {
      await prisma.institution.create({
        data: {
          user_id: userRecord.uid,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente.',
      data: {
        uid: userRecord.uid,
        email,
        name,
        username: username || email.split('@')[0],
        role,
        tempPassword, // Send this to admin so they can share with user
      },
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      message: error.message || 'Error al crear usuario.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Bloquear una cuenta de usuario
 * Solo los administradores pueden bloquear usuarios
 */
export const blockUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        registered_user: {
          select: {
            username: true,
            email: true,
            admin: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    // No permitir bloquear administradores
    if (user.registered_user?.admin) {
      return res.status(403).json({
        success: false,
        message: 'No se puede bloquear una cuenta de administrador.',
      });
    }

    // Verificar si ya está bloqueado
    if (user.blocked) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está bloqueado.',
      });
    }

    // Bloquear el usuario
    await prisma.user.update({
      where: { user_id: userId },
      data: { blocked: true },
    });

    // Invalidar todas las sesiones activas del usuario
    await prisma.session.deleteMany({
      where: { user_id: userId },
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario bloqueado exitosamente.',
      data: {
        userId,
        username: user.registered_user?.username,
        email: user.registered_user?.email,
      },
    });
  } catch (error) {
    console.error('Error bloqueando usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al bloquear usuario.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Desbloquear una cuenta de usuario
 * Solo los administradores pueden desbloquear usuarios
 */
export const unblockUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        registered_user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    // Verificar si no está bloqueado
    if (!user.blocked) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no está bloqueado.',
      });
    }

    // Desbloquear el usuario
    await prisma.user.update({
      where: { user_id: userId },
      data: { blocked: false },
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario desbloqueado exitosamente.',
      data: {
        userId,
        username: user.registered_user?.username,
        email: user.registered_user?.email,
      },
    });
  } catch (error) {
    console.error('Error desbloqueando usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al desbloquear usuario.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Obtener el estado de bloqueo de un usuario
 */
export const getUserBlockStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { blocked: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId,
        blocked: user.blocked,
      },
    });
  } catch (error) {
    console.error('Error obteniendo estado de bloqueo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estado de bloqueo.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// GET /api/users/admin/dashboard/stats
// Get dashboard statistics (admin only)
export async function getDashboardStats(req, res) {
  try {
    // Total de usuarios
    const totalUsers = await prisma.user.count();

    // Total de usuarios bloqueados
    const blockedUsers = await prisma.user.count({
      where: { blocked: true },
    });

    // Total de reportes por estado
    const totalReports = await prisma.user_report.count();
    const pendingReports = await prisma.user_report.count({
      where: { status: 'Pending' },
    });
    const dismissedReports = await prisma.user_report.count({
      where: { status: 'Dismissed' },
    });
    const resolvedReports = await prisma.user_report.count({
      where: { status: 'Resolved' },
    });

    // Estado de las cachés de puntos de reciclaje (solo lectura)
    let cacheStatus = {
      navarra: { status: 'UNKNOWN', error: null },
      barcelona: { status: 'UNKNOWN', error: null },
    };

    try {
      // Consultar directamente sin crear registros
      const navarraCache = await prisma.cache_metadata.findUnique({
        where: { source: 'NAVARRA_POINTS' },
        select: { status: true, error_message: true },
      });

      if (navarraCache) {
        cacheStatus.navarra = {
          status: navarraCache.status,
          error: navarraCache.error_message || null,
        };
      }

      const barcelonaCache = await prisma.cache_metadata.findUnique({
        where: { source: 'BARCELONA_POINTS' },
        select: { status: true, error_message: true },
      });

      if (barcelonaCache) {
        cacheStatus.barcelona = {
          status: barcelonaCache.status,
          error: barcelonaCache.error_message || null,
        };
      }
    } catch (err) {
      console.error('Error fetching cache status:', err.message);
    }

    // Total de guías de reciclaje
    let totalGuides = 0;
    try {
      totalGuides = await prisma.recycling_guide_item.count();
    } catch (err) {
      console.error('Error counting recycling guides:', err.message);
    }

    // Total de puntos de reciclaje (activos)
    let totalRecyclingPoints = 0;
    try {
      totalRecyclingPoints = await prisma.recycling_point.count({
        where: { active: true },
      });
    } catch (err) {
      console.error('Error counting recycling points:', err.message);
    }

    // Total de publicaciones en el marketplace
    let totalPublications = 0;
    let activePublications = 0;
    try {
      totalPublications = await prisma.publication.count();
      activePublications = await prisma.publication.count({
        where: { publication_state: 'Pending' },
      });
    } catch (err) {
      console.error('Error counting publications:', err.message);
    }

    // Reportes recientes (últimos 5)
    const recentReports = await prisma.user_report.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        reported_user: {
          select: {
            user_id: true,
            username: true,
            email: true,
          },
        },
        reporter: {
          select: {
            user_id: true,
            username: true,
          },
        },
      },
    });

    // Usuarios recientes (últimos 5)
    const recentUsers = await prisma.registered_user.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        user_id: true,
        username: true,
        email: true,
        created_at: true,
      },
    });

    return res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          blocked: blockedUsers,
          active: totalUsers - blockedUsers,
        },
        reports: {
          total: totalReports,
          pending: pendingReports,
          dismissed: dismissedReports,
          resolved: resolvedReports,
        },
        guides: {
          total: totalGuides,
        },
        recyclingPoints: {
          total: totalRecyclingPoints,
        },
        publications: {
          total: totalPublications,
          active: activePublications,
        },
        cacheStatus: cacheStatus,
      },
      recent: {
        reports: recentReports.map((report) => ({
          id: report.report_id,
          reason: report.reason,
          status: report.status,
          reportedUser: {
            id: report.reported_user.user_id,
            username: report.reported_user.username,
            email: report.reported_user.email,
          },
          reporterUser: {
            id: report.reporter.user_id,
            username: report.reporter.username,
          },
          createdAt: report.created_at,
        })),
        users: recentUsers.map((user) => ({
          id: user.user_id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
