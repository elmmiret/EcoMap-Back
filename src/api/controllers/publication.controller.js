// src/api/controllers/publication.controller.js
import { prisma } from '#lib/prisma.js';
import { uploadToS3, deleteFromS3 } from '#services/storage.service.js';

/**
 * Crea una nueva publicación para un usuario (cliente).
 * Crea en una transacción: Publication -> Trade -> PublicationMedia (opcional)
 */
export const createTrade = async (req, res) => {
  // El UID del usuario autenticado viene del middleware (req.user.uid)
  const { uid } = req.user;
  const {
    title,
    description,
    itemState, // Enum: New, Little_used, Widely_used, Bad_condition
    pointsPrice,
  } = req.body;
  const imageFile = req.file; // Archivo subido (si existe)

  // Validaciones básicas
  if (!title || !itemState || pointsPrice === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos obligatorios: titulo, estado del objeto o precio.',
      code: 'MISSING_DATA',
    });
  }

  // Validar item state
  const validItemStates = ['New', 'Little_used', 'Widely_used', 'Bad_condition'];

  if (!validItemStates.includes(itemState)) {
    return res.status(400).json({
      success: false,
      message: `Estado del objeto inválido. Valores permitidos: ${validItemStates.join(', ')}`,
      code: 'INVALID_ITEM_STATE',
    });
  }

  try {
    // si hay imagen, subir a S3 y obtener la URL
    let mediaUrl = null;
    if (imageFile) {
      try {
        mediaUrl = await uploadToS3(imageFile);
      } catch (uploadError) {
        console.error('Error subiendo imagen a S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error al subir la imagen.',
          code: 'IMAGE_UPLOAD_ERROR',
        });
      }
    }

    // usamos una transacción para asegurar que se cree todo o nada
    const newPublication = await prisma.$transaction(async (tx) => {
      // crear la publicación principal
      const publication = await tx.publication.create({
        data: {
          title,
          description: description || null,
          date: new Date(), // Fecha actual
          publication_state: 'Pending', // Estado inicial por defecto
          client_id: uid, // Vinculamos al usuario autenticado
        },
      });

      // crear el 'trade' asociado
      await tx.trade.create({
        data: {
          publication_id: publication.publication_id,
          item_state: itemState,
          points_price: Number(pointsPrice),
        },
      });

      // si hay imagen, crear registro en publication_media (guardar S3 URL)
      if (mediaUrl) {
        await tx.publication_media.create({
          data: {
            media_url: mediaUrl,
            publication_id: publication.publication_id,
          },
        });
      }

      return publication;
    });

    // Recuperamos la estructura completa para devolver al cliente
    const fullPublication = await prisma.publication.findUnique({
      where: { publication_id: newPublication.publication_id },
      include: {
        trade: true,
        publication_media: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Publicación creada exitosamente.',
      data: fullPublication,
    });
  } catch (error) {
    console.error('Error al crear publicación:', error);
    // Manejo de error si el usuario no es un 'client' (integridad referencial)
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene perfil de cliente válido para crear publicaciones.',
        code: 'INVALID_CLIENT',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno al crear la publicación.',
      code: 'PUBLICATION_CREATION_ERROR',
    });
  }
};

/** Crea una nueva publicación de tipo Recompensa para una Institución.
 * Crea en una transacción: Publication -> Reward -> PublicationMedia (opcional)
 */
export const createReward = async (req, res) => {
  const { uid } = req.user;
  const { title, description, content, pointsPrice } = req.body;
  const imageFile = req.file; // Archivo subido (si existe)

  if (!title || !content || pointsPrice === undefined) {
    return res.status(400).json({ success: false, message: 'Faltan datos: título, contenido o precio.' });
  }

  try {
    // verificar que el usuario sea institution
    const isInstitution = await prisma.institution.findUnique({ where: { user_id: uid } });
    if (!isInstitution) {
      return res.status(403).json({
        success: false,
        message: 'Permiso denegado. Solo las instituciones pueden crear recompensas.',
        code: 'FORBIDDEN_INSTITUTION_ONLY',
      });
    }

    let mediaUrl = null;
    if (imageFile) {
      try {
        mediaUrl = await uploadToS3(imageFile);
      } catch (uploadError) {
        console.error('Error subiendo imagen a S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error al subir la imagen.',
          code: 'IMAGE_UPLOAD_ERROR',
        });
      }
    }

    const newReward = await prisma.$transaction(async (tx) => {
      // crear publicación vinculada a la Institución
      const publication = await tx.publication.create({
        data: {
          title,
          description,
          date: new Date(),
          publication_state: 'Pending', // O 'Completed' si se publican directamente
          institution_id: uid, // Vinculamos a INSTITUCIÓN
          client_id: null, // No hay cliente
        },
      });

      // 3. Crear entrada en tabla 'reward'
      await tx.reward.create({
        data: {
          publication_id: publication.publication_id,
          content: content,
          points_price: Number(pointsPrice),
        },
      });

      if (mediaUrl) {
        await tx.publication_media.create({
          data: {
            media_url: mediaUrl,
            publication_id: publication.publication_id,
          },
        });
      }
      return publication;
    });

    // devolvemos con los detalles de reward incluidos
    const fullReward = await prisma.publication.findUnique({
      where: { publication_id: newReward.publication_id },
      include: { reward: true, publication_media: true },
    });

    return res.status(201).json({ success: true, message: 'Recompensa creada.', data: fullReward });
  } catch (error) {
    console.error('Error creando recompensa:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene TODAS las publicaciones de tipo 'reward'.
 * Endpoint: GET /api/publications/rewards/all
 */
export const getAllRewards = async (req, res) => {
  try {
    const rewards = await prisma.publication.findMany({
      where: { reward: { isNot: null } },
      include: {
        reward: true,
        publication_media: true,
        institution: {
          select: { registered_user: { select: { name: true, username: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${rewards.length} rewards.`,
      data: rewards,
    });
  } catch (error) {
    console.error('Error obteniendo rewards:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene TODAS las publicaciones de tipo 'reward' de una institución específica.
 * Endpoint: GET /api/publications/rewards/institution/:institutionId
 */
export const getInstitutionRewards = async (req, res) => {
  // CAMBIO: Extraemos 'institutionId' en lugar de 'id'
  const { institutionId } = req.params;

  try {
    const rewards = await prisma.publication.findMany({
      where: {
        institution_id: institutionId,
        reward: { isNot: null },
      },
      include: {
        reward: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${rewards.length} rewards para la institución ${institutionId}.`,
      data: rewards,
    });
  } catch (error) {
    console.error('Error obteniendo rewards de institución:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Actualiza la disponibilidad de un reward (available: true/false).
 * Si available pasa a false -> La publicación pasa a 'Completed'.
 * Si available pasa a true  -> La publicación pasa a 'Pending' (para que vuelva a ser visible).
 * Permisos: Institución creadora O Administrador.
 * Endpoint: PATCH /api/publications/rewards/:id/availability
 */
export const updateRewardAvailability = async (req, res) => {
  const { id } = req.params;
  const { available } = req.body;
  const { uid } = req.user;

  if (typeof available !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Debes enviar el parámetro "available" como booleano (true/false).',
      code: 'INVALID_DATA_TYPE',
    });
  }

  try {
    // Buscar publicación y verificar que es un reward
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { reward: true },
    });

    if (!publication || !publication.reward) {
      return res.status(404).json({ success: false, message: 'Reward no encontrado.' });
    }

    const isOwner = publication.institution_id === uid;
    
    // Si no es el dueño, comprobamos si es admin
    let isAdmin = false;
    if (!isOwner) {
      const adminUser = await prisma.admin.findUnique({
        where: { user_id: uid },
      });
      if (adminUser) isAdmin = true;
    }

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este reward.',
        code: 'FORBIDDEN_ACTION',
      });
    }

    // inicio de la transacción
    const result = await prisma.$transaction(async (tx) => {
      
      // actualizar la disponibilidad en la tabla Reward
      const updatedReward = await tx.reward.update({
        where: { publication_id: id },
        data: { available: available },
      });

      // actualizar el estado en la tabla Publication según la disponibilidad
      let newState = publication.publication_state;

      if (available === false) {
        // Si NO está disponible, la damos por finalizada/completada
        newState = 'Completed';
      } else {
        // Si vuelve a estar disponible, la ponemos en Pendiente (visible)
        newState = 'Pending';
      }

      const updatedPublication = await tx.publication.update({
        where: { publication_id: id },
        data: { publication_state: newState },
      });

      // Retornamos los datos combinados para la respuesta
      return { 
        ...updatedPublication, 
        reward: updatedReward 
      };
    });

    return res.status(200).json({
      success: true,
      message: `Disponibilidad actualizada a ${available} (Estado: ${result.publication_state}).`,
      data: result,
    });

  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Actualiza el contenido de un Reward.
 * Permite editar título, descripción, contenido, precio y estado (solo a Cancelled).
 * Gestiona el reemplazo de la imagen en S3 y BD.
 * Endpoint: PATCH /api/publications/rewards/:id/body
 */
export const updateRewardBody = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;
  const { title, description, state, content, pointsPrice } = req.body;
  const imageFile = req.file;

  try {
    // obtenemos la publicación actual con sus relaciones
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { reward: true, publication_media: true },
    });

    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    // verificamos que es un Reward
    if (!publication.reward) {
      return res.status(400).json({ success: false, message: 'Esta publicación no es un Reward.' });
    }

    // verificamos permisos (solo la institución creadora)
    if (publication.institution_id !== uid) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar este reward.' });
    }

    // validamos el cambio de estado (solo permitido 'Cancelled' por esta vía)
    if (state && state !== 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Por este endpoint solo puedes cambiar el estado a "Cancelled".',
        code: 'INVALID_STATE_UPDATE',
      });
    }

    // gestión de la magen (subida a S3)
    let newMediaUrl = null;
    if (imageFile) {
      try {
        newMediaUrl = await uploadToS3(imageFile);
      } catch (err) {
        console.error('Error subiendo la imagen:', err);
        return res.status(500).json({ success: false, message: 'Error al subir la nueva imagen.' });
      }
    }

    // transacción de actualización
    const updatedResult = await prisma.$transaction(async (tx) => {
      
      // A. Actualizar tabla base 'publication'
      const updatedPub = await tx.publication.update({
        where: { publication_id: id },
        data: {
          ...(title && { title }),
          ...(description && { description }),
          // Solo actualizamos el estado si se proporcionó y pasó la validación
          ...(state && { publication_state: state }),
        },
      });

      // B. Actualizar tabla específica 'reward'
      if (content || pointsPrice !== undefined) {
        await tx.reward.update({
          where: { publication_id: id },
          data: {
            ...(content && { content }),
            ...(pointsPrice !== undefined && { points_price: Number(pointsPrice) }),
          },
        });
      }

      // C. Gestión de Imagen (Borrado antiguo e inserción nueva)
      if (newMediaUrl) {
        // 1. Borrar imagen vieja de S3 si existe
        if (publication.publication_media && publication.publication_media.media_url) {
          await deleteFromS3(publication.publication_media.media_url);
        }

        // 2. Borrar referencia vieja en BD (para asegurar unicidad o limpieza)
        await tx.publication_media.deleteMany({
          where: { publication_id: id },
        });

        // 3. Crear nueva referencia
        await tx.publication_media.create({
          data: {
            media_url: newMediaUrl,
            publication_id: id,
          },
        });
      }

      return updatedPub;
    });

    // 7. Retornar el objeto actualizado completo
    const finalReward = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { reward: true, publication_media: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Reward actualizado correctamente.',
      data: finalReward,
    });

  } catch (error) {
    console.error('Error actualizando reward:', error);
    return res.status(500).json({ success: false, message: 'Error interno al actualizar.' });
  }
};

/** Elimina una publicación de tipo trade o reward verificando permisos y estado.
 * Endpoint: DELETE /api/publications/:id
 */
export const deletePublication = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;

  try {
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { publication_media: true },
    });

    if (!publication) return res.status(404).json({ success: false, message: 'No encontrada' });

    // verificamos roles
    const isOwner = publication.client_id === uid || publication.institution_id === uid;
    const isAdmin = await prisma.admin.findUnique({ where: { user_id: uid } });

    // lógica de permisos
    if (isAdmin) {
      // un 'admin' tiene permiso absoluto (puede borrar incluso si está 'Completed'),
      // así que aquí no hacemos nada
    } else if (isOwner) {
      // el 'dueño' tiene permiso condicional,
      // solo puede borrar si NO está completada
      if (publication.publication_state === 'Completed') {
        return res.status(409).json({ 
          success: false, 
          message: 'No puedes eliminar una publicación que ya ha sido completada/finalizada.' 
        });
      }
    } else {
      // ni dueño ni admin
      return res.status(403).json({ success: false, message: 'No autorizado para eliminar.' });
    }

    // borramos

    // si tiene imagen asociada, la eliminamos de S3
    if (publication.publication_media && publication.publication_media.media_url) {
      await deleteFromS3(publication.publication_media.media_url);
    }

    // eliminamos de la base de datos
    await prisma.publication.delete({ where: { publication_id: id } });

    return res.status(200).json({ success: true, message: 'Publicación eliminada.' });
  } catch (error) {
    console.error('Error eliminando publicación:', error);
    return res.status(500).json({ success: false, message: 'Error eliminando.' });
  }
};

/**
 * Obtiene todas las publicaciones de un usuario específico.
 * Endpoint: /api/publications/trades/user/:userId
 */
export const getUserTrades = async (req, res) => {
  // CAMBIO: Extraemos 'userId' en lugar de 'id'
  const { userId } = req.params;

  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userId,
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${publications.length} publicaciones.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener las publicaciones del usuario.',
      code: 'GET_PUBLICATIONS_ERROR',
    });
  }
};

/**
 * Obtiene TODAS las publicaciones de tipo 'trade' a través de la tabla 'trade'.
 * Endpoint: /api/publications/all
 */
export const getAllTrades = async (req, res) => {
  try {
    // Consultamos la tabla 'trade' e incluimos la publicación anidada
    const trades = await prisma.trade.findMany({
      include: {
        publication: {
          include: {
            trade: true, // Datos del precio y estado
            publication_media: true, // Imágenes
            client: {
              // Datos del autor (opcional)
              include: {
                registered_user: {
                  select: {
                    username: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc', // Ordenar por fecha de creación del trade
      },
    });

    // Aplanamos la respuesta para devolver directamente un array de publicaciones
    const publications = trades.map((trade) => ({
      ...trade.publication,
      trade_id: trade.trade_id, // Añadimos el ID del trade por si es útil
      item_state: trade.item_state,
      points_price: trade.points_price,
      trade_created_at: trade.created_at,
    }));

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${publications.length} publicaciones en total.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener todas las publicaciones (trades):', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el listado global de publicaciones.',
      code: 'GET_ALL_TRADES_ERROR',
    });
  }
};

/**
 * Obtiene el detalle de una publicación específica por su ID.
 * Endpoint: /api/publications/:id
 */
export const getTradeById = async (req, res) => {
  const { id } = req.params;

  try {
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: {
        trade: true, // Detalles del intercambio (estado, precio)
        publication_media: true, // Imágenes
        // Incluimos datos del autor para mostrar quién la creó
        client: {
          include: {
            registered_user: {
              select: {
                username: true,
                name: true,
                // Puedes añadir profile_picture si tu esquema lo permite acceder desde aquí
              },
            },
          },
        },
      },
    });

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada.',
        code: 'PUBLICATION_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Publicación obtenida correctamente.',
      data: publication,
    });
  } catch (error) {
    console.error(`Error al obtener la publicación ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el detalle de la publicación.',
      code: 'GET_PUBLICATION_ERROR',
    });
  }
};

/**
 * Obtiene todas las publicaciones con estado 'Completed'.
 * Endpoint: /api/publications/all/completed
 */
export const getAllCompletedTrades = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: {
        publication_state: 'Completed',
        trade: { isNot: null },
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `Se encontraron ${publications.length} publicaciones completadas.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones completadas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene todas las publicaciones con estado 'Cancelled'.
 * Endpoint: /api/publications/all/cancelled
 */
export const getAllCancelledTrades = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: {
        publication_state: 'Cancelled',
        trade: { isNot: null },
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `Se encontraron ${publications.length} publicaciones canceladas.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones canceladas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene todas las publicaciones con estado 'Pending'.
 * Endpoint: /api/publications/all/pending
 */
export const getAllPendingTrades = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: {
        publication_state: 'Pending',
        trade: { isNot: null },
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `Se encontraron ${publications.length} publicaciones pendientes.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones pendientes:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

// --- FUNCIONES PARA OBTENER PUBLICACIONES POR ESTADO (DE UN USUARIO) ---

/**
 * Obtiene las publicaciones completadas de un usuario específico.
 * Endpoint: /api/publications/trades/user/:userId/completed
 */
export const getUserCompletedTrades = async (req, res) => {
  // CAMBIO: Extraemos 'userId'
  const { userId } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userId,
        publication_state: 'Completed',
        trade: { isNot: null }, // Importante: filtro de trade
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `El usuario tiene ${publications.length} publicaciones completadas.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones completadas del usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene las publicaciones canceladas de un usuario específico.
 * Endpoint: /api/publications/trades/user/:userId/cancelled
 */
export const getUserCancelledTrades = async (req, res) => {
  // CAMBIO: Extraemos 'userId'
  const { userId } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userId,
        publication_state: 'Cancelled',
        trade: { isNot: null },
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `El usuario tiene ${publications.length} publicaciones canceladas.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones canceladas del usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene las publicaciones pendientes de un usuario específico.
 * Endpoint: /api/publications/trades/user/:userId/pending
 */
export const getUserPendingTrades = async (req, res) => {
  // CAMBIO: Extraemos 'userId'
  const { userId } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userId,
        publication_state: 'Pending',
        trade: { isNot: null },
      },
      include: {
        trade: true,
        publication_media: true,
      },
      orderBy: { date: 'desc' },
    });
    return res.status(200).json({
      success: true,
      message: `El usuario tiene ${publications.length} publicaciones pendientes.`,
      data: publications,
    });
  } catch (error) {
    console.error('Error al obtener publicaciones pendientes del usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Actualiza el estado de una publicación y comprueba que el nuevo estado sea válido y diferente al actual.
 * Endpoint: PATCH /api/publications/:id/state
 */
export const updateTradeState = async (req, res) => {
  const { id } = req.params;
  const { state } = req.body; // El nuevo estado, ej: "Cancelled"
  const { uid } = req.user; // ID del usuario autenticado

  // validar que el estado enviado sea parte del Enum state_type
  const validStates = ['Completed', 'Cancelled', 'Pending'];
  if (!state || !validStates.includes(state)) {
    return res.status(400).json({
      success: false,
      message: `Estado inválido. Valores permitidos: ${validStates.join(', ')}.`,
      code: 'INVALID_STATE_VALUE',
    });
  }

  try {
    // buscar la publicación para verificar propiedad y estado actual
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
    });

    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada.',
        code: 'PUBLICATION_NOT_FOUND',
      });
    }

    // verificar que el usuario sea el dueño
    if (publication.client_id !== uid) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta publicación.',
        code: 'FORBIDDEN_ACTION',
      });
    }

    // validar que el nuevo estado sea diferente al actual
    if (publication.publication_state === state) {
      return res.status(409).json({
        success: false,
        message: 'El nuevo estado debe ser diferente al estado actual.',
        code: 'SAME_STATE_ERROR',
      });
    }

    // actualizar el estado
    const updatedPublication = await prisma.publication.update({
      where: { publication_id: id },
      data: { publication_state: state },
    });

    return res.status(200).json({
      success: true,
      message: `Estado actualizado correctamente a ${state}.`,
      data: updatedPublication,
    });
  } catch (error) {
    console.error(`Error al actualizar el estado de la publicación ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el estado.',
      code: 'UPDATE_STATE_ERROR',
    });
  }
};

/**
 * Actualiza el contenido de un Trade (Título, Descripción e Imagen).
 * Endpoint: PATCH /api/publications/trades/:id/body
 */
export const updateTradeBody = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;
  const { title, description } = req.body;
  const imageFile = req.file;

  try {
    // buscar la publicación
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { trade: true, publication_media: true }, // Verificar que sea un trade
    });

    if (!publication) {
      return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
    }

    // verificar que sea un Trade (no Reward)
    if (!publication.trade) {
      return res.status(400).json({ success: false, message: 'Esta publicación no es un Trade.' });
    }

    // verificar propiedad
    if (publication.client_id !== uid) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta publicación.' });
    }

    // subir imagen si existe
    let mediaUrl = null;
    if (imageFile) {
      try {
        mediaUrl = await uploadToS3(imageFile);
      } catch (err) {
        console.error('Error subiendo la imgen:', err);
        return res.status(500).json({ success: false, message: 'Error subiendo imagen.' });
      }
    }

    // actualizar en transacción
    const updatedPub = await prisma.$transaction(async (tx) => {
      // actualizar datos básicos
      const pub = await tx.publication.update({
        where: { publication_id: id },
        data: {
          // solo actualizamos si el campo viene en el body (undefined se ignora)
          ...(title && { title }),
          ...(description && { description }),
        },
      });

      // si hay nueva imagen, la añadimos a la galería
      if (mediaUrl) {
        // borramos la imagen antigua de S3 si existe
        if (publication.publication_media && publication.publication_media.media_url) {
          await deleteFromS3(publication.publication_media.media_url);
        }

        // borramos ref. en la base de datos
        await tx.publication_media.deleteMany({
          where: { publication_id: id },
        });

        // creamos nueva ref.
        await tx.publication_media.create({
          data: {
            media_url: mediaUrl,
            publication_id: id,
          },
        });
      }

      return pub;
    });

    return res.status(200).json({
      success: true,
      message: 'Publicación actualizada.',
      data: updatedPub,
    });
  } catch (error) {
    console.error('Error actualizando trade:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};
