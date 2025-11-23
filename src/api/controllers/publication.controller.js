// src/api/controllers/publication.controller.js
import { prisma } from '#lib/prisma.js';

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
    mediaUrl, // URL de la imagen (opcional)
  } = req.body;

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
    // Usamos una transacción para asegurar que se cree todo o nada
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

      // si hay imagen, crear registro en publication_media
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
  const { title, description, content, pointsPrice, mediaUrl } = req.body;

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
          data: { media_url: mediaUrl, publication_id: publication.publication_id },
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
 * Endpoint: GET /api/publications/rewards/:id
 */
export const getInstitutionRewards = async (req, res) => {
  const { id } = req.params; // ID de la institución

  try {
    const rewards = await prisma.publication.findMany({
      where: {
        institution_id: id,
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
      message: `Se encontraron ${rewards.length} rewards para la institución ${id}.`,
      data: rewards,
    });
  } catch (error) {
    console.error('Error obteniendo rewards de institución:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/**
 * Actualiza la disponibilidad de un reward (available: true/false).
 * Solo la institución creadora puede hacerlo.
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
    // buscar publicación y verificar que es un reward
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: { reward: true },
    });

    if (!publication || !publication.reward) {
      return res.status(404).json({ success: false, message: 'Reward no encontrado.' });
    }

    // verificar propiedad (solo la institución dueña)
    if (publication.institution_id !== uid) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este reward.',
        code: 'FORBIDDEN_ACTION',
      });
    }

    // actualizar disponibilidad
    await prisma.reward.update({
      where: { publication_id: id },
      data: { available: available },
    });

    return res.status(200).json({
      success: true,
      message: `Disponibilidad actualizada a ${available}.`,
      data: { ...publication, reward: { ...publication.reward, available } },
    });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    return res.status(500).json({ success: false, message: 'Error interno.' });
  }
};

/** Elimina una publicación de tipo trade o reward verificando permisos.
 *  Endpoint: DELETE /api/publications/:id
 */
export const deletePublication = async (req, res) => {
  const { id } = req.params;
  const { uid } = req.user;

  try {
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
    });

    if (!publication) return res.status(404).json({ success: false, message: 'No encontrada' });

    // Verificar si es dueño (cliente o institución)
    const isOwner = publication.client_id === uid || publication.institution_id === uid;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'No autorizado para eliminar.' });
    }

    await prisma.publication.delete({ where: { publication_id: id } });

    return res.status(200).json({ success: true, message: 'Publicación eliminada.' });
  } catch (error) {
    console.error('Error eliminando publicación:', error);
    return res.status(500).json({ success: false, message: 'Error eliminando.' });
  }
};

/**
 * Obtiene todas las publicaciones de un usuario específico.
 * Endpoint: /api/publications/:id/show
 */
export const getUserTrades = async (req, res) => {
  const { id: userIdToFetch } = req.params;

  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userIdToFetch,
      },
      include: {
        trade: true, // Incluir detalles del objeto (precio, estado)
        publication_media: true, // Incluir fotos
      },
      orderBy: {
        date: 'desc', // Las más recientes primero
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
    // Si prefieres devolver la estructura del trade, quita el .map()
    const publications = trades.map((trade) => ({
      ...trade.publication,
      trade_id: trade.trade_id, // Añadimos el ID del trade por si es útil
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
      where: { publication_state: 'Completed' },
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
      where: { publication_state: 'Cancelled' },
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
      where: { publication_state: 'Pending' },
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
 * Endpoint: /api/publications/:id/completed
 */
export const getUserCompletedTrades = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Completed',
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
 * Endpoint: /api/publications/:id/cancelled
 */
export const getUserCancelledTrades = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Cancelled',
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
 * Endpoint: /api/publications/:id/pending
 */
export const getUserPendingTrades = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Pending',
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
