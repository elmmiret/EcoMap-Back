import { prisma } from '../lib/prisma.js';

export const MAX_USER_POINTS = 20000;

// --- CONSTANTES DE PUNTOS ---
// Definimos los valores permitidos para cada tipo de acción para mantener la economía balanceada.
export const POINTS_RULES = {
  ECO_TRADER_SALE: [5, 10, 25, 50], // Vender/Donar objetos
  RECYCLING_ACTION: [5, 10, 25, 50], // Reciclaje verificado
  EVENT_ATTENDANCE: [25, 50, 100], // Asistencia a eventos
  REWARD_REDEMPTION: [500, 1000, 2000, 5000], // Coste de recompensas
  ADMIN_ADJUSTMENT: null, // Flexible para correcciones de soporte
};

/**
 * Valida si una cantidad de puntos es permitida para una fuente específica.
 * @param {string} source - El origen de los puntos (enum point_source)
 * @param {number} amount - La cantidad (puede ser positiva o negativa)
 * @returns {boolean}
 */
export const isValidPointAmount = (source, amount) => {
  const allowedValues = POINTS_RULES[source];

  // Si es ADMIN_ADJUSTMENT o no tiene reglas definidas, permitimos cualquier valor
  if (!allowedValues) return true;

  // Verificamos el valor absoluto (para que funcione tanto al sumar como al restar puntos)
  return allowedValues.includes(Math.abs(amount));
};

/**
 * Procesa una transacción de puntos (añadir o restar) de forma atómica.
 * Actualiza el saldo del usuario y crea una entrada en el historial.
 * * @param {string} userId - UUID del usuario (client)
 * @param {number} amount - Cantidad de puntos (positivo para ganar, negativo para gastar)
 * @param {string} source - Origen (ECO_TRADER_SALE, RECYCLING_ACTION, etc.)
 * @param {string} description - Descripción legible para el historial
 * @returns {Promise<Object>} - El objeto con el nuevo saldo y el log
 */
export const processPoints = async (userId, amount, source, description) => {
  // 1. Validación de reglas de negocio
  if (!isValidPointAmount(source, amount)) {
    const allowed = POINTS_RULES[source]?.join(', ');
    throw new Error(`Cantidad de puntos (${Math.abs(amount)}) no válida para '${source}'. Valores permitidos: [${allowed}]`);
  }

  // 2. Transacción en Base de Datos (Todo o nada)
  return await prisma.$transaction(async (tx) => {
    // A. Obtener saldo actual para verificaciones
    const currentClient = await tx.client.findUnique({
      where: { user_id: userId },
      select: { points: true },
    });

    if (!currentClient) {
      throw new Error('Perfil de cliente no encontrado para este usuario.');
    }

    // B. Evitar saldo negativo si estamos gastando puntos
    // (amount es negativo en caso de gasto, ej: -500)
    // EXCEPCIÓN: Permitir saldo negativo para ajustes de administrador
    if (amount < 0 && source !== 'ADMIN_ADJUSTMENT' && currentClient.points + amount < 0) {
      throw new Error(`Saldo insuficiente. Tienes ${currentClient.points} EcoPoints y necesitas ${Math.abs(amount)}.`);
    }

    // C. Evitar superar el límite máximo de puntos al otorgar puntos
    // (amount es positivo cuando se otorgan puntos)
    if (amount > 0 && currentClient.points + amount > MAX_USER_POINTS) {
      throw new Error(
        `Límite máximo de puntos alcanzado. El usuario tiene ${currentClient.points} EcoPoints y el límite es ${MAX_USER_POINTS}. No se pueden otorgar ${amount} puntos adicionales.`
      );
    }

    // D. Actualizar el saldo del cliente
    const updatedClient = await tx.client.update({
      where: { user_id: userId },
      data: {
        points: {
          increment: amount,
        },
      },
    });

    // E. Registrar el movimiento en el historial
    const historyLog = await tx.point_history.create({
      data: {
        user_id: userId,
        amount: amount,
        source: source,
        description: description,
      },
    });

    return {
      newBalance: updatedClient.points,
      historyLog,
    };
  });
};

/**
 * Obtiene el historial de puntos de un usuario paginado o limitado.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getHistory = async (userId) => {
  return await prisma.point_history.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 50, // Limitamos a los últimos 50 movimientos por defecto
  });
};

/**
 * Obtiene el saldo actual de puntos de un usuario.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export const getBalance = async (userId) => {
  const client = await prisma.client.findUnique({
    where: { user_id: userId },
    select: { points: true },
  });
  return client?.points || 0;
};
