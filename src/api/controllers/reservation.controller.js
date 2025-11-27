import { prisma } from '#lib/prisma.js';

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
            include: { publication: true } // Incluimos info del trade y publicación
          },
          client: {
            include: { registered_user: { select: { username: true, email: true } } }
          }
        },
        orderBy: { reservation_date: 'desc' }
      });
  
      return res.status(200).json({
        success: true,
        message: `Se encontraron ${reservations.length} reservas.`,
        data: reservations
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
            include: { publication: true }
          },
          client: {
            include: { registered_user: { select: { username: true, name: true } } }
          }
        }
      });
  
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reserva no encontrada.',
          code: 'RESERVATION_NOT_FOUND'
        });
      }
  
      return res.status(200).json({
        success: true,
        message: 'Reserva encontrada.',
        data: reservation
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
  export const getReservationsByUser = async (req, res) => {
    const { userId } = req.params;
  
    try {
      const reservations = await prisma.reservation.findMany({
        where: { client_id: userId },
        include: {
          trade: {
            include: { publication: true }
          }
        },
        orderBy: { reservation_date: 'desc' }
      });
  
      return res.status(200).json({
        success: true,
        message: `El usuario tiene ${reservations.length} reservas.`,
        data: reservations
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
  export const getReservationByUserAndId = async (req, res) => {
    const { userId, reservationId } = req.params;
  
    try {
      const reservation = await prisma.reservation.findFirst({
        where: {
          reservation_id: reservationId,
          client_id: userId // debe pertenecer al usuario
        },
        include: {
          trade: {
            include: { publication: true }
          }
        }
      });
  
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reserva no encontrada para este usuario.',
          code: 'RESERVATION_NOT_FOUND'
        });
      }
  
      return res.status(200).json({
        success: true,
        message: 'Reserva encontrada.',
        data: reservation
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
            include: { publication: true } // necesario para acceder al client_id (dueño)
          }
        }
      });
  
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reserva no encontrada.',
          code: 'RESERVATION_NOT_FOUND'
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
          code: 'FORBIDDEN_ACTION'
        });
      }
  
      // eliminar la reserva
      await prisma.reservation.delete({
        where: { reservation_id: reservationId }
      });
  
      return res.status(200).json({
        success: true,
        message: 'Reserva cancelada correctamente.'
      });
  
    } catch (error) {
      console.error(`Error cancelando reserva ${reservationId}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al cancelar la reserva.',
        code: 'SERVER_ERROR'
      });
    }
  };

  /**
 * Confirma una reserva existente y finaliza el proceso.
 * - Pone 'confirmed' a true.
 * - Crea la entrada en 'reservation_ended'.
 * - Actualiza el estado de la publicación a 'Completed'.
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
        code: 'INVALID_ACTION_BODY'
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
              publication: true // necesario para acceder al client_id (dueño)
            }
          }
        }
      });
  
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reserva no encontrada.',
          code: 'RESERVATION_NOT_FOUND'
        });
      }
  
      // Verificar permisos: ¿Es el usuario el dueño del Trade?
      // reservation.trade.publication.client_id es el dueño original
      if (reservation.trade.publication.client_id !== uid) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para confirmar esta reserva. Solo el propietario del artículo puede hacerlo.',
          code: 'FORBIDDEN_NOT_OWNER'
        });
      }
  
      // verificar si ya estaba confirmada
      if (reservation.confirmed || reservation.reservation_ended) {
        return res.status(409).json({
          success: false,
          message: 'Esta reserva ya ha sido confirmada anteriormente.',
          code: 'ALREADY_CONFIRMED'
        });
      }
  
      // 4. Ejecutar la lógica en transacción (Todo o nada)
      const result = await prisma.$transaction(async (tx) => {
        // actualizar la reserva a confirmed: true
        const updatedRes = await tx.reservation.update({
          where: { reservation_id: reservationId },
          data: { confirmed: true }
        });
  
        // crear la entrada en reservation_ended
        const endedRes = await tx.reservation_ended.create({
          data: {
            reservation_id: reservationId
            // ended_at se pone solo con default(now())
          }
        });
  
        // cerrar la publicación original del trade (poner estado 'Completed')
        await tx.publication.update({
          where: { publication_id: reservation.trade.publication_id },
          data: { publication_state: 'Completed' }
        });
  
        return { reservation: updatedRes, reservation_ended: endedRes };
      });
  
      return res.status(200).json({
        success: true,
        message: 'Reserva confirmada y finalizada correctamente.',
        data: result
      });
  
    } catch (error) {
      console.error(`Error confirmando reserva ${reservationId}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error interno al confirmar la reserva.',
        code: 'SERVER_ERROR'
      });
    }
  };