// src/api/controllers/publication.controller.js
import { prisma } from '#lib/prisma.js';

/**
 * Crea una nueva publicación para un usuario (cliente).
 * Crea en una transacción: Publication -> ObjectTrade -> PublicationMedia (opcional)
 */
export const createPublication = async (req, res) => {
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
      message: 'Faltan datos obligatorios (titulo, estado del objeto o precio).',
      code: 'MISSING_DATA',
    });
  }

  try {
    // Usamos una transacción para asegurar que se cree todo o nada
    const newPublication = await prisma.$transaction(async (tx) => {
      // 1. Crear la publicación principal
      const publication = await tx.publication.create({
        data: {
          title,
          description: description || null,
          date: new Date(), // Fecha actual
          publication_state: 'Pending', // Estado inicial por defecto
          client_id: uid, // Vinculamos al usuario autenticado
        },
      });

      // 2. Crear los detalles del objeto a tradear (Object Trade)
      // La ID es la misma que la publication_id (relación 1 a 1 por ID compartida)
      await tx.object_trade.create({
        data: {
          publication_id: publication.publication_id,
          item_state: itemState,
          points_price: Number(pointsPrice),
        },
      });

      // 3. Si hay imagen, crear registro en publication_media
      if (mediaUrl) {
        await tx.publication_media.create({
          data: {
            media_url: mediaUrl,
            publication_id: publication.publication_id,
          },
        });
      }

      // 4. Añadir a la tabla 'trade' para listado global
      await tx.trade.create({
        data: {
          publication_id: publication.publication_id,
        },
      });

      // Devolvemos la publicación creada (para luego hacer un fetch limpio si queremos)
      return publication;
    });

    // Recuperamos la estructura completa para devolver al cliente
    const fullPublication = await prisma.publication.findUnique({
      where: { publication_id: newPublication.publication_id },
      include: {
        object_trade: true,
        publication_media: true,
        trade: true,
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

    // Manejo de error si el enum itemState es inválido
    if (error.code === 'P2002' || (error.message && error.message.includes('item_state'))) {
      return res.status(400).json({
        success: false,
        message: 'Estado del objeto inválido.',
        code: 'INVALID_ITEM_STATE',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno al crear la publicación.',
      code: 'PUBLICATION_CREATION_ERROR',
    });
  }
};

/**
 * Obtiene todas las publicaciones de un usuario específico.
 * Endpoint: /api/publications/:id/show
 */
export const getUserPublications = async (req, res) => {
  const { id: userIdToFetch } = req.params;

  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userIdToFetch,
      },
      include: {
        object_trade: true, // Incluir detalles del objeto (precio, estado)
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
export const getAllPublications = async (req, res) => {
  try {
    // Consultamos la tabla 'trade' e incluimos la publicación anidada
    const trades = await prisma.trade.findMany({
      include: {
        publication: {
          include: {
            object_trade: true, // Datos del precio y estado
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
export const getPublicationById = async (req, res) => {
  const { id } = req.params;

  try {
    const publication = await prisma.publication.findUnique({
      where: { publication_id: id },
      include: {
        object_trade: true,      // Detalles del intercambio (estado, precio)
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
export const getAllCompletedPublications = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: { publication_state: 'Completed' },
      include: {
        object_trade: true,
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
export const getAllCancelledPublications = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: { publication_state: 'Cancelled' },
      include: {
        object_trade: true,
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
export const getAllPendingPublications = async (req, res) => {
  try {
    const publications = await prisma.publication.findMany({
      where: { publication_state: 'Pending' },
      include: {
        object_trade: true,
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
export const getUserCompletedPublications = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Completed',
      },
      include: {
        object_trade: true,
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
export const getUserCancelledPublications = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Cancelled',
      },
      include: {
        object_trade: true,
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
export const getUserPendingPublications = async (req, res) => {
  const { id } = req.params;
  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: id,
        publication_state: 'Pending',
      },
      include: {
        object_trade: true,
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
export const updatePublicationState = async (req, res) => {
  const { id } = req.params;
  const { state } = req.body; // El nuevo estado, ej: "Cancelled"
  const { uid } = req.user;   // ID del usuario autenticado

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