import { prisma } from '#lib/prisma.js';

/**
 * Message Service
 * Handles all operations related to the 'message' table
 */

/**
 * Creates a new message in a chat
 * @param {string} chatId
 * @param {string} senderId
 * @param {string} content
 * @param {Array<string>} mediaUrls
 * @returns {Promise<object>}
 */
export async function createMessage(chatId, senderId, content, mediaUrls = []) {
  return prisma.message.create({
    data: {
      chat_id: chatId,
      sender_id: senderId,
      content: content,
      message_media: {
        create: mediaUrls.map((url) => ({ media_url: url })),
      },
    },
    include: {
      message_media: true,
    },
  });
}

/**
 * Get messages for a specific chat with pagination
 * @param {string} chatId
 * @param {number} limit
 * @param {string|null} before - Cursor for pagination
 * @returns {Promise<Array>}
 */
export async function getMessagesByChatId(chatId, limit = 50, before = null) {
  const query = {
    where: { chat_id: chatId },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      message_media: true,
    },
  };

  if (before) {
    query.cursor = { message_id: before };
    query.skip = 1;
  }

  return prisma.message.findMany(query);
}

/**
 * Marks a specific message as delivered
 * @param {string} messageId
 * @returns {Promise<object>}
 */
export async function markMessageAsDelivered(messageId) {
  return prisma.message.update({
    where: { message_id: messageId },
    data: { delivered: true },
  });
}

/**
 * Marks multiple messages as delivered
 * @param {Array<string>} messageIds
 * @returns {Promise<object>}
 */
export async function markMessagesAsDelivered(messageIds) {
  return prisma.message.updateMany({
    where: { message_id: { in: messageIds } },
    data: { delivered: true },
  });
}

/**
 * Marks all unread messages in a chat as read for a specific user
 * @param {string} chatId
 * @param {string} userId - The user who is reading (marks messages NOT sent by them)
 * @returns {Promise<object>}
 */
export async function markMessagesAsRead(chatId, userId) {
  return prisma.message.updateMany({
    where: {
      chat_id: chatId,
      sender_id: { not: userId },
      is_read: false,
    },
    data: {
      is_read: true,
    },
  });
}

/**
 * Soft deletes a message (sets is_deleted and clears content)
 * @param {string} messageId
 * @returns {Promise<object>}
 */
export async function softDeleteMessage(messageId) {
  return prisma.message.update({
    where: { message_id: messageId },
    data: {
      is_deleted: true,
      content: '', // Clear content for privacy
    },
    include: {
      message_media: true,
    },
  });
}

/**
 * Gets a single message by ID
 * @param {string} messageId
 * @returns {Promise<object|null>}
 */
export async function getMessageById(messageId) {
  return prisma.message.findUnique({
    where: { message_id: messageId },
    include: {
      message_media: true,
    },
  });
}
