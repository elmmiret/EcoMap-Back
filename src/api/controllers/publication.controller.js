// src/api/controllers/publication.controller.js
import { prisma } from '#lib/prisma.js';
import { uploadToS3, deleteFromS3 } from '#services/storage.service.js';
import * as gamificationService from '#services/gamification.service.js';
import { getCache, setCache } from '#services/cache.service.js';

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

  // Validar que el precio de puntos sea uno de los valores permitidos
  const allowedPointsPrices = gamificationService.POINTS_RULES.ECO_TRADER_SALE || [5, 10, 25, 50];
  if (!allowedPointsPrices.includes(Number(pointsPrice))) {
    return res.status(400).json({
      success: false,
      message: `Precio de puntos inválido. Valores permitidos: ${allowedPointsPrices.join(', ')}`,
      code: 'INVALID_POINTS_PRICE',
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

    const allowedPointsPrices = gamificationService.POINTS_RULES.REWARD_REDEMPTION || [500, 1000, 2000, 5000];
    if (!allowedPointsPrices.includes(Number(pointsPrice))) {
      return res.status(400).json({
        success: false,
        message: `Precio de puntos inválido. Valores permitidos: ${allowedPointsPrices.join(', ')}`,
        code: 'INVALID_POINTS_PRICE',
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
        reward: updatedReward,
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
          message: 'No puedes eliminar una publicación que ya ha sido completada/finalizada.',
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

export const getAllTrades = async (req, res) => {
  // 1. Configuración de paginación
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    let whereClause = {};
    let useGlobalCache = true; // Por defecto intentamos usar caché

    // Si el usuario está autenticado, verificamos su lista de bloqueados
    if (req.user && req.user.uid) {
      const currentUser = await prisma.registered_user.findUnique({
        where: { user_id: req.user.uid },
        select: { blocked_users: true },
      });

      // Si tiene usuarios bloqueados, aplicamos el filtro
      if (currentUser && currentUser.blocked_users.length > 0) {
        whereClause = {
          publication: {
            client_id: {
              notIn: currentUser.blocked_users, // EXCLUIR los IDs bloqueados
            },
          },
        };
        useGlobalCache = false;
      }
    }

    // Key de caché única para la primera página
    const cacheKey = `trades_list_p${page}_l${limit}`;

    // 2. Intentar servir desde caché (Solo página 1 Y si no hay filtros de bloqueo activos)
    if (page === 1 && useGlobalCache) {
      const cachedResponse = await getCache(cacheKey);
      if (cachedResponse) {
        return res.status(200).json(cachedResponse);
      }
    }

    // 3. Consulta optimizada a la base de datos
    const [total, trades] = await Promise.all([
      // El conteo también debe respetar el filtro de bloqueados
      prisma.trade.count({ where: whereClause }), 
      
      prisma.trade.findMany({
        where: whereClause, // Aplicamos el filtro de bloqueo aquí
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        select: {
          trade_id: true,
          item_state: true,
          points_price: true,
          created_at: true,
          publication: {
            select: {
              publication_id: true,
              title: true,
              description: true,
              publication_media: {
                select: { media_url: true },
              },
              client: {
                select: {
                  registered_user: {
                    select: { username: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // 4. Formatear respuesta
    const formattedTrades = trades.map((trade) => ({
      id: trade.trade_id,
      publication_id: trade.publication.publication_id,
      title: trade.publication.title,
      description: trade.publication.description
        ? trade.publication.description.substring(0, 100) + (trade.publication.description.length > 100 ? '...' : '')
        : null,
      price: trade.points_price,
      state: trade.item_state,
      image: trade.publication.publication_media?.media_url || null,
      author: trade.publication.client?.registered_user?.username || 'Anónimo',
      date: trade.created_at,
    }));

    const response = {
      success: true,
      message: `Se encontraron ${formattedTrades.length} publicaciones (Página ${page}).`,
      data: formattedTrades,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
    
    // 5. Guardar en caché SOLO si es la primera página Y es una lista "limpia" (sin filtros personales)
    if (page === 1 && useGlobalCache) {
      await setCache(cacheKey, response, 300);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error al obtener trades paginados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el listado de publicaciones.',
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
 * Obtiene el detalle completo de un Reward por su ID.
 * Incluye datos de la publicación, datos específicos del reward, imagen y datos de la institución.
 * Endpoint: GET /api/publications/rewards/:id
 */
export const getRewardById = async (req, res) => {
  const { id } = req.params;

  try {
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: {
        // Incluimos la parte específica de Reward
        reward: true,
        // Incluimos la imagen si tiene
        publication_media: true,
        // Incluimos datos de la institución creadora (nombre, username, etc.)
        institution: {
          include: {
            registered_user: {
              select: {
                name: true,
                username: true,
                profile_picture: true, // Por si la institución tiene logo
              },
            },
          },
        },
      },
    });

    // verificar si existe la publicación
    if (!publication) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada.',
        code: 'PUBLICATION_NOT_FOUND',
      });
    }

    // verificar si es realmente un Reward
    if (!publication.reward) {
      return res.status(404).json({
        success: false,
        message: 'Esta publicación existe pero no es una Recompensa (Reward).',
        code: 'NOT_A_REWARD',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recompensa obtenida correctamente.',
      data: publication,
    });
  } catch (error) {
    console.error(`Error al obtener el reward ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener el detalle de la recompensa.',
      code: 'GET_REWARD_ERROR',
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
 * Actualiza el contenido de un Trade (Título, Descripción, Precio de Puntos e Imagen).
 * Endpoint: PATCH /api/publications/trades/:id/body
 */
export const updateTradeBody = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;
  const { title, description, pointsPrice } = req.body;
  const imageFile = req.file; // Archivo subido (opcional)

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

    // Validar precio de puntos si se proporciona
    if (pointsPrice !== undefined) {
      const allowedPointsPrices = gamificationService.POINTS_RULES.ECO_TRADER_SALE || [5, 10, 25, 50];
      if (!allowedPointsPrices.includes(Number(pointsPrice))) {
        return res.status(400).json({
          success: false,
          message: `Precio de puntos inválido. Valores permitidos: ${allowedPointsPrices.join(', ')}`,
          code: 'INVALID_POINTS_PRICE',
        });
      }
    }

    // subir imagen si existe
    let mediaUrl = null;
    if (imageFile) {
      try {
        mediaUrl = await uploadToS3(imageFile);
      } catch (err) {
        console.error('Error subiendo la imagen:', err);
        return res.status(500).json({ success: false, message: 'Error subiendo imagen.' });
      }
    }

    // actualizar en transacción
    const updatedPub = await prisma.$transaction(async (tx) => {
      // actualizar datos básicos de la publicación
      const pub = await tx.publication.update({
        where: { publication_id: id },
        data: {
          // solo actualizamos si el campo viene en el body (undefined se ignora)
          ...(title && { title }),
          ...(description && { description }),
        },
      });

      // actualizar precio de puntos en la tabla trade si se proporciona
      if (pointsPrice !== undefined) {
        await tx.trade.update({
          where: { publication_id: id },
          data: { points_price: Number(pointsPrice) },
        });
      }

      // si hay nueva imagen, reemplazamos la anterior
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

    // Recuperar la publicación actualizada con todos los datos
    const fullUpdatedPub = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: {
        trade: true,
        publication_media: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Publicación actualizada.',
      data: fullUpdatedPub,
    });
  } catch (error) {
    console.error('Error actualizando trade:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Registra la compra de un Reward por parte de un cliente.
 * - Crea el registro en 'reward_bought_by'.
 * - Deduce los puntos del cliente (opcional, pero recomendado).
 * - Mantiene el historial del precio en el momento de la compra.
 * Endpoint: POST /api/publications/rewards/:rewardId/buy
 */
export const buyReward = async (req, res) => {
  const { rewardId } = req.params;
  const { uid } = req.user; // ID del cliente comprador

  try {
    // 1. Obtener el reward y validar existencia y disponibilidad
    const publication = await prisma.publication.findUnique({
      where: { publication_id: rewardId },
      include: { reward: true },
    });

    if (!publication || !publication.reward) {
      return res.status(404).json({ success: false, message: 'Reward no encontrado.' });
    }

    if (!publication.reward.available) {
      return res.status(409).json({ success: false, message: 'Este reward no está disponible actualmente.' });
    }

    // 2. Verificar que el usuario es un Cliente
    const client = await prisma.client.findUnique({ where: { user_id: uid } });
    if (!client) {
      return res.status(403).json({ success: false, message: 'Solo los clientes pueden comprar rewards.' });
    }

    // 3. Verificar si tiene puntos suficientes
    const cost = publication.reward.points_price;
    if (client.points < cost) {
      return res.status(400).json({
        success: false,
        message: `Puntos insuficientes. Tienes ${client.points}, necesitas ${cost}.`,
      });
    }

    // 4. TRANSACCIÓN DE COMPRA
    const purchaseResult = await prisma.$transaction(async (tx) => {
      // A. Crear el registro en la tabla asociativa
      // Al hacer esto, Prisma actualiza automáticamente 'buyers' en el reward y 'rewards_bought' en el cliente.
      const newPurchase = await tx.reward_bought_by.create({
        data: {
          client_id: uid,
          reward_id: rewardId,
          points_cost: cost,
          bought_at: new Date(),
        },
      });

      // B. Restar los puntos al cliente
      await tx.client.update({
        where: { user_id: uid },
        data: {
          points: { decrement: cost },
        },
      });

      // C. Registrar en el historial de puntos
      await tx.point_history.create({
        data: {
          user_id: uid,
          amount: -cost, // Negativo porque es un gasto
          source: 'REWARD_REDEMPTION',
          description: `Canje de reward: ${publication.title}`,
        },
      });

      return newPurchase;
    });

    return res.status(201).json({
      success: true,
      message: 'Reward comprado exitosamente.',
      data: purchaseResult,
    });
  } catch (error) {
    console.error('Error en buyReward:', error);
    return res.status(500).json({ success: false, message: 'Error interno al procesar la compra.' });
  }
};

/**
 * Obtiene todos los rewards comprados por un usuario específico.
 * Endpoint: GET /api/publications/rewards/user/:userId/bought
 */
export const getUserBoughtRewards = async (req, res) => {
  const { userId } = req.params;

  try {
    const boughtHistory = await prisma.reward_bought_by.findMany({
      where: { client_id: userId },
      include: {
        // Incluimos los detalles del reward comprado
        reward: {
          include: {
            publication: {
              include: {
                publication_media: true, // Para ver la foto del reward
                institution: {
                  select: { registered_user: { select: { name: true } } }, // Para ver quién lo vendió
                },
              },
            },
          },
        },
      },
      orderBy: { bought_at: 'desc' }, // Los más recientes primero
    });

    // Formateamos la respuesta para que sea más limpia
    const formattedData = boughtHistory.map((item) => ({
      purchase_id: item.id,
      bought_at: item.bought_at,
      points_cost: item.points_cost,
      reward_details: {
        title: item.reward.publication.title,
        description: item.reward.publication.description,
        image: item.reward.publication.publication_media?.media_url || null,
        institution_name: item.reward.publication.institution?.registered_user?.name || 'Desconocido',
        current_price: item.reward.points_price, // Por si ha cambiado respecto al precio de compra
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error('Error obteniendo rewards comprados:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Obtiene todos los clientes que han comprado un reward específico.
 * Endpoint: GET /api/publications/rewards/:rewardId/buyers
 */
export const getRewardBuyers = async (req, res) => {
  const { rewardId } = req.params;
  const { uid } = req.user;

  try {
    // Verificar permisos: Solo la institución dueña debería ver quién ha comprado.
    const publication = await prisma.publication.findUnique({
      where: { publication_id: rewardId },
      select: { institution_id: true },
    });

    if (!publication) return res.status(404).json({ success: false, message: 'Publicación no encontrada' });

    if (publication.institution_id !== uid) return res.status(403).json({ success: false, message: 'No autorizado' });

    const buyersList = await prisma.reward_bought_by.findMany({
      where: { reward_id: rewardId },
      include: {
        client: {
          include: {
            registered_user: {
              select: {
                user_id: true,
                username: true,
                name: true,
                surname: true,
                profile_picture: true,
              },
            },
          },
        },
      },
      orderBy: { bought_at: 'desc' },
    });

    const formattedBuyers = buyersList.map((item) => ({
      purchase_id: item.id,
      bought_at: item.bought_at,
      cost_paid: item.points_cost,
      buyer: {
        uid: item.client.registered_user.user_id,
        username: item.client.registered_user.username,
        name: `${item.client.registered_user.name} ${item.client.registered_user.surname || ''}`.trim(),
        profile_picture: item.client.registered_user.profile_picture,
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedBuyers.length,
      data: formattedBuyers,
    });
  } catch (error) {
    console.error('Error obteniendo compradores del reward:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};
