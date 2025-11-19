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
    mediaUrl // URL de la imagen (opcional)
  } = req.body;

  // Validaciones básicas
  if (!title || !itemState || pointsPrice === undefined) {
    return res.status(400).json({
        success: false,
        message: 'Faltan datos obligatorios (titulo, estado del objeto o precio).',
        code: 'MISSING_DATA'
    });
  }

  // Validar que itemState sea válido según el enum de Prisma
  const validItemStates = ['New', 'Little used', 'Widely used', 'Bad condition'];
  // Mapeo simple para manejar el espacio en los strings si vienen como "Little_used" vs "Little used"
  // Prisma espera el valor exacto definido en el schema o su mapeo.
  // Asumimos que el front envía el string correcto.

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
            }
        });

      // 2. Crear los detalles del objeto a tradear (Object Trade)
      // La ID es la misma que la publication_id (relación 1 a 1 por ID compartida)
        await tx.object_trade.create({
            data: {
                publication_id: publication.publication_id,
                item_state: itemState,
                points_price: Number(pointsPrice)
            }
        });

      // 3. Si hay imagen, crear registro en publication_media
        if (mediaUrl) {
            await tx.publication_media.create({
                data: {
                    media_url: mediaUrl,
                    publication_id: publication.publication_id
                }
            });
        }

      // Devolvemos la publicación creada (para luego hacer un fetch limpio si queremos)
        return publication;
    });

    // Recuperamos la estructura completa para devolver al cliente
    const fullPublication = await prisma.publication.findUnique({
        where: { publication_id: newPublication.publication_id },
        include: {
            object_trade: true,
            publication_media: true
        }
    });

    return res.status(201).json({
        success: true,
        message: 'Publicación creada exitosamente.',
        data: fullPublication
    });

  } catch (error) {
    console.error('Error al crear publicación:', error);
    // Manejo de error si el usuario no es un 'client' (integridad referencial)
    if (error.code === 'P2003') {
        return res.status(400).json({
            success: false,
            message: 'El usuario no tiene perfil de cliente válido para crear publicaciones.',
            code: 'INVALID_CLIENT'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'Error interno al crear la publicación.',
        code: 'PUBLICATION_CREATION_ERROR'
    });
  }
};

/**
 * Obtiene todas las publicaciones de un usuario específico.
 * Endpoint: /api/publications/:id/show
 * Nota: Actualmente solo muestra las creadas por el usuario.
 * Si en el futuro hay una tabla "Transactions" o "Trades", se añadirían aquí.
 */
export const getUserPublications = async (req, res) => {
  const { id: userIdToFetch } = req.params;

  try {
    const publications = await prisma.publication.findMany({
      where: {
        client_id: userIdToFetch
      },
      include: {
        object_trade: true, // Incluir detalles del objeto (precio, estado)
        publication_media: true // Incluir fotos
      },
      orderBy: {
        date: 'desc' // Las más recientes primero
      }
    });

    return res.status(200).json({
        success: true,
        message: `Se encontraron ${publications.length} publicaciones.`,
        data: publications
    });

  } catch (error) {
    console.error('Error al obtener publicaciones:', error);
    return res.status(500).json({
        success: false,
        message: 'Error al obtener las publicaciones del usuario.',
        code: 'GET_PUBLICATIONS_ERROR'
    });
  }
};