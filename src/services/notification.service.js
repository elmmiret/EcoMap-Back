import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';
import { markMessageAsDelivered } from '#services/message.service.js';
import admin from 'firebase-admin';

const log = createLogger('notification-service');

/**
 * Registers a device token for a user.
 * @param {string} userId
 * @param {string} token
 */
export async function registerDeviceToken(userId, token) {
  return prisma.device_token.upsert({
    where: { token },
    update: { user_id: userId },
    create: {
      token,
      user_id: userId,
    },
  });
}

/**
 * Sends a push notification to a user's registered devices.
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 * @param {object} data
 */
export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const tokens = await prisma.device_token.findMany({
      where: { user_id: userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Adjust based on frontend framework
      },
      tokens: tokens.map((t) => t.token),
    };

    const response = await admin.messaging().sendMulticast(message);

    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });

      // Remove invalid tokens
      if (failedTokens.length > 0) {
        await prisma.device_token.deleteMany({
          where: { token: { in: failedTokens } },
        });
      }
    }

    if (response.successCount > 0 && data.type === 'NEW_MESSAGE' && data.message_id) {
      await markMessageAsDelivered(data.message_id);
    }

    log.info(`Notification sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failure`);
  } catch (error) {
    log.error('Error sending push notification:', error);
  }
}

/**
 * Creates a notification in the database
 * @param {string} userId
 * @param {string} type
 * @param {string} content
 */
export async function createNotification(userId, type, content) {
  return prisma.notification.create({
    data: {
      user_id: userId,
      notification_type: type,
      content: content,
    },
  });
}
