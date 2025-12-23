import * as gamificationService from '#services/gamification.service.js';

/**
 * Obtiene el perfil de gamificación del usuario autenticado.
 * Incluye saldo actual, historial de movimientos y las reglas de puntos vigentes.
 * * Endpoint: GET /api/gamification/me
 * Acceso: Client
 */
export const getMyGamificationProfile = async (req, res) => {
  const { uid } = req.user;

  try {
    const [balance, history] = await Promise.all([gamificationService.getBalance(uid), gamificationService.getHistory(uid)]);

    res.status(200).json({
      success: true,
      data: {
        balance,
        history,
        rules: gamificationService.POINTS_RULES,
        limit: gamificationService.MAX_USER_POINTS,
      },
    });
  } catch (error) {
    console.error('Error obteniendo perfil de gamificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los datos de EcoPoints.',
      code: 'GAMIFICATION_PROFILE_ERROR',
    });
  }
};

/**
 * Permite a una Institución o Admin otorgar puntos manualmente a un usuario.
 * Se usa para validar acciones físicas (ej: "Usuario entrega pilas en mostrador").
 * * Endpoint: POST /api/gamification/grant
 * Acceso: Admin, Institution
 */
export const grantPoints = async (req, res) => {
  // targetUserId: El usuario (cliente) que recibe los puntos
  // source: 'RECYCLING_ACTION' | 'EVENT_ATTENDANCE'
  const { targetUserId, amount, source, description } = req.body;

  if (!targetUserId || !amount || !source) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos requeridos (targetUserId, amount, source).',
      code: 'MISSING_DATA',
    });
  }

  const ALLOWED_MANUAL_SOURCES = ['RECYCLING_ACTION', 'EVENT_ATTENDANCE', 'ADMIN_ADJUSTMENT'];

  if (!ALLOWED_MANUAL_SOURCES.includes(source)) {
    return res.status(400).json({
      success: false,
      message: `Fuente de puntos no válida para asignación manual. Permitidos: ${ALLOWED_MANUAL_SOURCES.join(', ')}`,
      code: 'INVALID_SOURCE',
    });
  }

  try {
    // Procesar los puntos llamando al servicio
    const result = await gamificationService.processPoints(targetUserId, Number(amount), source, description || 'Validación manual');

    res.status(200).json({
      success: true,
      message: `Se han otorgado ${amount} EcoPoints correctamente.`,
      data: result,
    });
  } catch (error) {
    console.error('Error otorgando puntos:', error);

    // Manejo de errores específicos del servicio
    if (error.message.includes('Límite máximo')) {
      return res.status(409).json({
        // 409 Conflict
        success: false,
        message: error.message,
        code: 'MAX_POINTS_LIMIT_REACHED',
      });
    }

    if (error.message.includes('Cantidad de puntos')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_POINT_AMOUNT',
      });
    }

    if (error.message.includes('no encontrado')) {
      return res.status(404).json({
        success: false,
        message: 'Usuario destino no encontrado.',
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno al procesar los puntos.',
      code: 'SERVER_ERROR',
    });
  }
};
