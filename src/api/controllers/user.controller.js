// CONTIENE LA LOGICA (getUser, createUser, etc.)

import { prisma } from '#lib/prisma.js';
import { signUserJWT } from '#lib/jwt.js';

/**
 * Lógica para sincronizar el usuario autenticado (desde Firebase) a PostgreSQL.
 * Crea: user -> registered_user -> client
 */
export const syncUserToPostgres = async (req, res) => {
  // Los datos del usuario (uid, email, name, etc.) vienen verificados del middleware req.user
  const { uid, email, name, surname, phone_number, picture } = req.user;

  // Validación básica de los datos
  if (!uid || !email) {
    return res.status(400).json({
      success: false,
      message: 'Datos de usuario incompletos (uid o email faltante).',
      code: 'INCOMPLETE_DATA',
    });
  }

  // Validar que name esté disponible (es NOT NULL en registered_user)
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'El nombre del usuario es obligatorio.',
      code: 'NAME_REQUIRED',
    });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      include: {
        user: true,
        client: true,
      },
    });

    if (existingUser) {
      // Determinar el rol
      let role = 'client';
      if (existingUser.admin) role = 'admin';
      if (existingUser.institution) role = 'institution';

      // Generar JWT
      const jwtPayload = {
        uid: existingUser.user_id,
        email: existingUser.email,
        name: existingUser.name,
        surname: existingUser.surname,
        profile_picture: existingUser.client?.profile_picture || null,
        role,
        points: existingUser.client?.points || 0,
        streak: existingUser.client?.streak || 0,
      };
      const jwt = signUserJWT(jwtPayload);

      // Opcional: guardar el JWT en la BD si quieres revocación
      // await prisma.session.upsert({ ... })

      return res.status(200).json({
        success: true,
        message: 'Usuario ya existía',
        jwt,
      });
    }

    // Crear el usuario completo en una transacción
    const newUser = await prisma.$transaction(async (tx) => {
      // 1. Crear user base
      const user = await tx.user.create({
        data: {
          user_id: uid,
        },
      });

      // 2. Crear registered_user
      const registeredUser = await tx.registered_user.create({
        data: {
          user_id: uid,
          name: name,
          email: email,
          app_language: 'Spanish',
          // Campos opcionales
          ...(surname && { surname: surname }),
        },
      });

      // 3. Crear client asociado
      const client = await tx.client.create({
        data: {
          user_id: uid,
          points: 0, // Puntos iniciales
          streak: 0, // Racha inicial
          // Campos opcionales
          ...(picture && { profile_picture: picture }),
          ...(phone_number && { phone: parseInt(phone_number) }),
        },
      });

      return { user, registeredUser, client };
    });

    // Determinar el rol
    let role = 'client';
    // Generar JWT
    const jwtPayload = {
      uid: newUser.registeredUser.user_id,
      email: newUser.registeredUser.email,
      name: newUser.registeredUser.name,
      surname: newUser.registeredUser.surname,
      profile_picture: newUser.client.profile_picture || null,
      role,
      points: newUser.client.points,
      streak: newUser.client.streak,
    };
    const jwt = signUserJWT(jwtPayload);

    // Opcional: guardar el JWT en la BD si quieres revocación
    // await prisma.session.create({ ... })

    return res.status(201).json({
      success: true,
      message: 'Usuario y cliente sincronizados correctamente',
      jwt,
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
