import { prisma } from '#lib/prisma.js';
import { processPoints, MAX_USER_POINTS } from '#services/gamification.service.js';

/**
 * Crea una reserva para un 'trade'.
 * Regla: El solicitante (Client) NO puede ser el propietario del Trade.
 * Endpoint: POST /api/reservations/create
 */
export const createReservation = async (req, res) => {
  const { uid } = req.user; // id del usuario que quiere hacer la reserva
  const { tradeId } = req.body; // id del trade a reservar

  if (!tradeId) {
    return res.status(400).json({
      success: false,
      message: 'Falta el tradeId.',
      code: 'MISSING_DATA',
    });
  }

  try {
    // Obtener el Trade y su Publicación padre para ver quién es el dueño
    const trade = await prisma.trade.findUnique({
      where: { trade_id: tradeId },
      include: {
        publication: true, // Necesitamos esto para acceder al client_id (dueño)
      },
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade no encontrado.',
        code: 'TRADE_NOT_FOUND',
      });
    }

    // Verificar que el trade esté activo
    if (trade.publication.publication_state !== 'Pending') {
      return res.status(409).json({
        success: false,
        message: 'Este artículo ya no está disponible para reservas.',
        code: 'ITEM_NOT_AVAILABLE',
      });
    }

    // Es el usuario el propietario?
    const ownerId = trade.publication.client_id;

    if (ownerId === uid) {
      return res.status(403).json({
        success: false,
        message: 'No puedes reservar tu propio Trade.',
        code: 'SELF_RESERVATION_FORBIDDEN',
      });
    }

    // Verificar si el usuario realmente es un cliente (Integridad FK)
    const isClient = await prisma.client.findUnique({ where: { user_id: uid } });
    if (!isClient) {
      return res.status(403).json({
        success: false,
        message: 'Solo los perfiles de tipo Cliente pueden reservar.',
        code: 'ONLY_CLIENTS_ALLOWED',
      });
    }

    // Crear la Reserva
    const newReservation = await prisma.reservation.create({
      data: {
        trade_id: tradeId,
        client_id: uid,
        // reservation_date se crea solo por el @default(now())
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente.',
      data: newReservation,
    });
  } catch (error) {
    console.error('Error creando reserva:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear la reserva.',
      code: 'RESERVATION_ERROR',
    });
  }
};

/**
 * Obtiene TODAS las reservas existentes en la base de datos.
 * Endpoint: GET /api/reservations
 */
export const getAllReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        trade: {
          include: { publication: true }, // Incluimos info del trade y publicación
        },
        client: {
          include: { registered_user: { select: { username: true, email: true } } },
        },
      },
      orderBy: { reservation_date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${reservations.length} reservas.`,
      data: reservations,
    });
  } catch (error) {
    console.error('Error obteniendo todas las reservas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene el detalle de una reserva específica por su ID.
 * Endpoint: GET /api/reservations/:reservationId
 */
export const getReservationById = async (req, res) => {
  const { reservationId } = req.params;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: reservationId },
      include: {
        trade: {
          include: { publication: true },
        },
        client: {
          include: { registered_user: { select: { username: true, name: true } } },
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada.',
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reserva encontrada.',
      data: reservation,
    });
  } catch (error) {
    console.error(`Error obteniendo reserva ${reservationId}:`, error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene todas las reservas de un usuario específico.
 * Endpoint: GET /api/reservations/user/:userId
 */
export const getReservationsByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const reservations = await prisma.reservation.findMany({
      where: { client_id: userId },
      include: {
        trade: {
          include: { publication: true },
        },
      },
      orderBy: { reservation_date: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `El usuario tiene ${reservations.length} reservas.`,
      data: reservations,
    });
  } catch (error) {
    console.error(`Error obteniendo reservas del usuario ${userId}:`, error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene una reserva específica de un usuario específico.
 * Valida que la reserva exista y pertenezca a ese usuario.
 * Endpoint: GET /api/reservations/user/:userId/:reservationId
 */
export const getReservationByUserIdAndId = async (req, res) => {
  const { userId, reservationId } = req.params;

  try {
    const reservation = await prisma.reservation.findFirst({
      where: {
        reservation_id: reservationId,
        client_id: userId, // debe pertenecer al usuario
      },
      include: {
        trade: {
          include: { publication: true },
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada para este usuario.',
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reserva encontrada.',
      data: reservation,
    });
  } catch (error) {
    console.error('Error obteniendo reserva específica de usuario:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Cancela (elimina) una reserva existente.
 * Permisos: Solo puede cancelar el creador de la reserva o el dueño del Trade.
 * Endpoint: DELETE /api/reservations/:reservationId/cancel
 */
export const deleteReservation = async (req, res) => {
  const { reservationId } = req.params;
  const { uid } = req.user; // id del usuario autenticado

  try {
    // buscar la reserva e incluir información del 'trade' para verificar propiedad
    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: reservationId },
      include: {
        trade: {
          include: { publication: true }, // necesario para acceder al client_id (dueño)
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada.',
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    if (reservation.confirmed) {
      return res.status(409).json({
        success: false,
        messsage: 'No se puede cancelar una reserva que ya ha sido confirmada.',
        code: 'CANNOT_CANCEL_CONFIRMED_RESERVATION',
      });
    }

    // verificar permisos, ¿es el creador de la reserva o el dueño del trade?
    const isRequester = reservation.client_id === uid;
    // ¿es el dueño del artículo que se va a intercambiar?
    const isTradeOwner = reservation.trade?.publication?.client_id === uid;

    if (!isRequester && !isTradeOwner) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cancelar esta reserva.',
        code: 'FORBIDDEN_ACTION',
      });
    }

    // eliminar la reserva
    await prisma.reservation.delete({
      where: { reservation_id: reservationId },
    });

    return res.status(200).json({
      success: true,
      message: 'Reserva cancelada correctamente.',
    });
  } catch (error) {
    console.error(`Error cancelando reserva ${reservationId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al cancelar la reserva.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Confirma una reserva existente y finaliza el proceso.
 * - Pone 'confirmed' a true.
 * - Crea la entrada en 'reservation_ended'.
 * - Actualiza el estado de la publicación a 'Completed'.
 * - Otorga EcoPoints al dueño del trade.
 * * Permisos: Solo el propietario del 'trade' puede confirmar.
 * Endpoint: PATCH /api/reservations/:reservationId
 */
export const confirmReservation = async (req, res) => {
  const { reservationId } = req.params;
  const { confirmed } = req.body; // { "confirmed": true }
  const { uid } = req.user; // id del dueño del trade que confirma

  // validación básica del body
  if (confirmed !== true) {
    return res.status(400).json({
      success: false,
      message: 'Para confirmar la reserva debes enviar { "confirmed": true } en el cuerpo.',
      code: 'INVALID_ACTION_BODY',
    });
  }

  try {
    // Buscar la reserva e incluir datos del Trade para ver quién es el dueño
    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: reservationId },
      include: {
        reservation_ended: true, // para verificar si ya existe
        trade: {
          include: {
            publication: true, // necesario para acceder al client_id (dueño)
          },
        },
        client: true, 
      },
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva no encontrada.',
        code: 'RESERVATION_NOT_FOUND',
      });
    }

    // Definimos las variables necesarias
    const sellerId = reservation.trade.publication.client_id;
    const buyerId = reservation.client_id;
    const pointsCost = reservation.trade.points_price;

    // Verificar permisos: ¿Es el usuario el dueño del Trade?
    if (sellerId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para confirmar esta reserva. Solo el propietario del artículo puede hacerlo.',
        code: 'FORBIDDEN_NOT_OWNER',
      });
    }

    // verificar si ya estaba confirmada
    if (reservation.confirmed || reservation.reservation_ended) {
      return res.status(409).json({
        success: false,
        message: 'Esta reserva ya ha sido confirmada anteriormente.',
        code: 'ALREADY_CONFIRMED',
      });
    }

    // Validar saldo del comprador
    if (reservation.client.points < pointsCost) {
      return res.status(402).json({ // 402 Payment Required
        success: false,
        message: `El comprador no tiene suficientes EcoPoints (${reservation.client.points}/${pointsCost}). No se puede completar la venta.`,
        code: 'BUYER_INSUFFICIENT_FUNDS',
      });
    }

    // Validar límite del vendedor (Necesitamos buscar sus puntos actuales primero)
    const seller = await prisma.client.findUnique({
      where: { user_id: sellerId },
      select: { points: true }
    });

    if (!seller) {
        return res.status(404).json({ success: false, message: 'Perfil de vendedor no encontrado.' });
    }

    if (seller.points + pointsCost > MAX_USER_POINTS) {
      return res.status(409).json({
        success: false,
        message: `La venta excedería tu límite máximo de EcoPoints (${MAX_USER_POINTS}). ¡Gasta puntos antes de ganar más!`,
        code: 'SELLER_MAX_POINTS_REACHED',
      });
    }

    // 4. Ejecutar la lógica en transacción (Todo o nada)
    const result = await prisma.$transaction(async (tx) => {
      // --- A. Gestión de Puntos ---
      
      // 1. Restar al Comprador
      await tx.client.update({
        where: { user_id: buyerId },
        data: { points: { decrement: pointsCost } }
      });
      
      await tx.point_history.create({
        data: {
          user_id: buyerId,
          amount: -pointsCost, // Negativo
          source: 'ECO_TRADER_SALE',
          description: `Compra en EcoTrader: ${reservation.trade.publication.title}`,
        }
      });

      // 2. Sumar al Vendedor
      await tx.client.update({
        where: { user_id: sellerId },
        data: { points: { increment: pointsCost } }
      });

      await tx.point_history.create({
        data: {
          user_id: sellerId,
          amount: pointsCost, // Positivo
          source: 'ECO_TRADER_SALE',
          description: `Venda en EcoTrader: ${reservation.trade.publication.title}`,
        }
      });

      // --- B. Gestión de Estados ---

      // 3. Confirmar Reserva
      const updatedRes = await tx.reservation.update({
        where: { reservation_id: reservationId },
        data: { confirmed: true },
      });

      // 4. Crear registro de finalización
      const endedRes = await tx.reservation_ended.create({
        data: { reservation_id: reservationId },
      });

      // 5. Cerrar publicación
      await tx.publication.update({
        where: { publication_id: reservation.trade.publication_id },
        data: { publication_state: 'Completed' },
      });

      return { reservation: updatedRes, reservation_ended: endedRes };
    });

    return res.status(200).json({
      success: true,
      message: 'Reserva confirmada y finalizada correctamente.',
      data: result,
    });
  } catch (error) {
    console.error(`Error confirmando reserva ${reservationId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al confirmar la reserva.',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Crea una valoración para una reserva finalizada.
 * Determina automáticamente quién es el 'target' (a quién se valora).
 * - Si el autor es el Dueño del Trade -> Valora al Cliente que reservó.
 * - Si el autor es el Cliente que reservó -> Valora al Dueño del Trade.
 * Endpoint: POST /api/reservations/ended/:reservationId/valorations
 */
export const createValoration = async (req, res) => {
  const { reservationId } = req.params;
  const { score, comment } = req.body;
  const { uid } = req.user; // id del usuario que hace la valoración

  if (score === undefined || !comment) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos obligatorios: puntuación (score) y comentario (comment).',
      code: 'MISSING_DATA',
    });
  }

  if (score < 0 || score > 10) {
    return res.status(400).json({
      success: false,
      message: 'La puntuación debe estar entre 0 y 10.',
      code: 'INVALID_SCORE',
    });
  }

  try {
    // 2. Buscar la reserva finalizada e incluir TODA la cadena de relaciones
    // Necesitamos llegar hasta la Publicación para saber quién es el dueño original
    const reservationEnded = await prisma.reservation_ended.findUnique({
      where: { reservation_id: reservationId },
      include: {
        reservation: {
          include: {
            trade: {
              include: {
                publication: true, // Para obtener client_id (Dueño)
              },
            },
          },
        },
        valorations: true, // Para verificar si ya ha valorado
      },
    });

    if (!reservationEnded) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró la reserva finalizada. Asegúrate de que la reserva ha sido confirmada primero.',
        code: 'RESERVATION_ENDED_NOT_FOUND',
      });
    }

    // 3. Identificar a los participantes
    const requesterId = reservationEnded.reservation.client_id; // El que pidió el objeto
    const ownerId = reservationEnded.reservation.trade.publication.client_id; // El dueño del objeto

    // 4. Verificar que el usuario (uid) es uno de los dos participantes
    if (uid !== requesterId && uid !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para valorar esta transacción. No eres ni el comprador ni el vendedor.',
        code: 'FORBIDDEN_NOT_PARTICIPANT',
      });
    }

    // 5. Verificar si YA ha valorado (Evitar duplicados)
    const alreadyValuated = reservationEnded.valorations.some((v) => v.valoration_owner === uid);
    if (alreadyValuated) {
      return res.status(409).json({
        success: false,
        message: 'Ya has enviado una valoración para esta reserva.',
        code: 'ALREADY_VALUATED',
      });
    }

    // 6. Calcular el Objetivo (Target)
    // Si soy el dueño, valoro al solicitante. Si soy el solicitante, valoro al dueño.
    const targetId = uid === ownerId ? requesterId : ownerId;

    const result = await prisma.$transaction(async (tx) => {
      // crear la valoración
      const newValoration = await tx.valoration.create({
        data: {
          score: Number(score),
          comment: comment,
          reservation_id: reservationId,
          valoration_owner: uid,
          valoration_target: targetId,
        },
      });

      // calcular el nuevo promedio usando la función agregada de prisma
      const aggregations = await tx.valoration.aggregate({
        _avg: {
          score: true,
        },
        where: {
          valoration_target: targetId,
        },
      });

      const newAverage = aggregations._avg.score || 0;

      // actualizar el cliente destinatario con el nuevo promedio de score
      await tx.client.update({
        where: { user_id: targetId },
        data: { valorations_score: newAverage },
      });

      return newValoration;
    });

    return res.status(201).json({
      success: true,
      message: 'Valoración creada y perfil actualizado exitosamente.',
      data: result,
    });
  } catch (error) {
    console.error('Error creando valoración:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al crear la valoración.',
      code: 'VALORATION_CREATION_ERROR',
    });
  }
};

/**
 * Obtiene todas las reservas finalizadas (reservation_ended).
 * Incluye la info de la reserva original y el trade.
 * Endpoint: GET /api/reservations/ended
 */
export const getAllEndedReservations = async (req, res) => {
  try {
    const endedReservations = await prisma.reservation_ended.findMany({
      include: {
        reservation: {
          include: {
            trade: {
              include: { publication: true },
            },
            client: {
              include: { registered_user: { select: { username: true, name: true } } },
            },
          },
        },
      },
      orderBy: { ended_at: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${endedReservations.length} reservas finalizadas.`,
      data: endedReservations,
    });
  } catch (error) {
    console.error('Error obteniendo reservas finalizadas:', error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene las reservas finalizadas de un usuario específico (las que él hizo).
 * Endpoint: GET /api/reservations/ended/user/:userId
 */
export const getEndedReservationsByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    const endedReservations = await prisma.reservation_ended.findMany({
      where: {
        reservation: {
          client_id: userId, // se filtra por el usuario que hizo la reserva
        },
      },
      include: {
        reservation: {
          include: {
            trade: {
              include: { publication: true },
            },
          },
        },
      },
      orderBy: { ended_at: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: `El usuario tiene ${endedReservations.length} reservas finalizadas.`,
      data: endedReservations,
    });
  } catch (error) {
    console.error(`Error obteniendo reservas finalizadas del usuario ${userId}:`, error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};

/**
 * Obtiene todas las valoraciones asociadas a una reserva finalizada.
 * Endpoint: GET /api/reservations/ended/:reservationId/valorations
 */
export const getReservationValorations = async (req, res) => {
  const { reservationId } = req.params;

  try {
    // Verificamos primero que la reserva finalizada exista
    const endedReservation = await prisma.reservation_ended.findUnique({
      where: { reservation_id: reservationId },
    });

    if (!endedReservation) {
      return res.status(404).json({
        success: false,
        message: 'Reserva finalizada no encontrada.',
        code: 'RESERVATION_ENDED_NOT_FOUND',
      });
    }

    // Buscamos las valoraciones
    const valorations = await prisma.valoration.findMany({
      where: { reservation_id: reservationId },
      include: {
        author: {
          // Quién hizo la valoración
          include: { registered_user: { select: { username: true } } },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Se encontraron ${valorations.length} valoraciones para esta reserva.`,
      data: valorations,
    });
  } catch (error) {
    console.error(`Error obteniendo valoraciones de reserva ${reservationId}:`, error);
    return res.status(500).json({ success: false, message: 'Error interno.', code: 'SERVER_ERROR' });
  }
};
