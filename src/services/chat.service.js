import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';
import { getIO, isUserConnected } from './socket.service.js';
import { sendPushNotification } from './notification.service.js';
import * as messageService from './message.service.js';

const log = createLogger('chat-service');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Common Prisma `include` for fetching chat with user details
 */
const chatInclude = {
  user1: {
    select: {
      user_id: true,
      registered_user: { select: { name: true, surname: true } },
      profile_picture: true,
    },
  },
  user2: {
    select: {
      user_id: true,
      registered_user: { select: { name: true, surname: true } },
      profile_picture: true,
    },
  },
  messages: {
    orderBy: { created_at: 'desc' },
    take: 1,
    include: {
      message_media: true,
    },
  },
};

/**
 * Formats a chat object for API response
 * @param {object} chat - Prisma chat object with includes
 * @param {string} currentUserId - ID of the user requesting
 * @returns {object} Formatted chat
 */
function formatChat(chat, currentUserId) {
  const otherUser = chat.user1_id === currentUserId ? chat.user2 : chat.user1;
  const lastMessage = chat.messages?.[0] || null;

  return {
    chat_id: chat.chat_id,
    other_user: {
      name: otherUser.registered_user.name,
      surname: otherUser.registered_user.surname,
      profile_picture: otherUser.profile_picture,
    },
    last_message: lastMessage
      ? {
          content: lastMessage.is_deleted ? 'Mensaje eliminado' : lastMessage.content,
          created_at: lastMessage.created_at,
          has_media: !lastMessage.is_deleted && lastMessage.message_media?.length > 0,
        }
      : null,
    unread_count: chat._count?.messages || 0,
    updated_at: chat.updated_at,
  };
}

/**
 * Formats a message object for API response
 * @param {object} message - Prisma message object
 * @returns {object} Formatted message
 */
function formatMessage(message) {
  return {
    message_id: message.message_id,
    chat_id: message.chat_id,
    content: message.is_deleted ? 'Mensaje eliminado' : message.content,
    media: message.is_deleted ? [] : message.message_media?.map((m) => m.media_url) || [],
    is_read: message.is_read,
    delivered: message.delivered,
    created_at: message.created_at,
    is_deleted: message.is_deleted,
  };
}

/**
 * Verifies that a user is a participant in a chat
 * @param {string} chatId
 * @param {string} userId
 * @returns {Promise<object>} The chat object
 * @throws {Error} If chat not found or user not in chat
 */
async function verifyChatAccess(chatId, userId) {
  const chat = await prisma.chat.findUnique({ where: { chat_id: chatId } });

  if (!chat) {
    throw new Error('CHAT_NOT_FOUND');
  }

  if (chat.user1_id !== userId && chat.user2_id !== userId) {
    throw new Error('USER_NOT_IN_CHAT');
  }

  return chat;
}

/**
 * Gets the recipient ID for a chat (the other user)
 * @param {object} chat
 * @param {string} currentUserId
 * @returns {string} Recipient user ID
 */
function getRecipientId(chat, currentUserId) {
  return chat.user1_id === currentUserId ? chat.user2_id : chat.user1_id;
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

/**
 * Creates a new chat or returns an existing one between two users
 * @param {string} user1Id
 * @param {string} user2Id
 * @returns {Promise<object>} Chat object with includes
 */
export async function createOrGetChat(user1Id, user2Id) {
  const [u1, u2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

  let chat = await prisma.chat.findUnique({
    where: {
      user1_id_user2_id: { user1_id: u1, user2_id: u2 },
    },
    include: {
      ...chatInclude,
      _count: {
        select: {
          messages: {
            where: {
              sender_id: { not: user1Id },
              is_read: false,
            },
          },
        },
      },
    },
  });

  if (!chat) {
    chat = await prisma.chat.create({
      data: { user1_id: u1, user2_id: u2 },
      include: {
        ...chatInclude,
        _count: true,
      },
    });
  }

  return chat;
}

/**
 * Retrieves all chats for a specific user
 * @param {string} userId
 * @returns {Promise<Array>} Array of formatted chats
 */
export async function getUserChats(userId) {
  const chats = await prisma.chat.findMany({
    where: {
      OR: [{ user1_id: userId }, { user2_id: userId }],
    },
    include: {
      ...chatInclude,
      _count: {
        select: {
          messages: {
            where: {
              sender_id: { not: userId },
              is_read: false,
            },
          },
        },
      },
    },
    orderBy: { updated_at: 'desc' },
  });

  return chats.map((chat) => formatChat(chat, userId));
}

/**
 * Sends a message in a chat
 * @param {string} chatId
 * @param {string} senderId
 * @param {string} content
 * @param {Array<string>} mediaUrls
 * @returns {Promise<object>} Formatted message
 */
export async function sendMessage(chatId, senderId, content, mediaUrls = []) {
  const chat = await verifyChatAccess(chatId, senderId);

  // Create message via message service
  const message = await messageService.createMessage(chatId, senderId, content, mediaUrls);

  // Update chat timestamp
  await prisma.chat.update({
    where: { chat_id: chatId },
    data: { updated_at: new Date() },
  });

  const formattedMessage = formatMessage(message);

  // Socket & Push notification orchestration
  try {
    const io = getIO();
    const recipientId = getRecipientId(chat, senderId);

    // Emit to both sender and recipient
    io.to(recipientId).emit('new_message', {
      chat_id: chatId,
      message: formattedMessage,
    });

    io.to(senderId).emit('new_message', {
      chat_id: chatId,
      message: formattedMessage,
    });

    // Send push notification if recipient is offline
    if (!isUserConnected(recipientId)) {
      const sender = await prisma.registered_user.findUnique({
        where: { user_id: senderId },
        select: { name: true },
      });

      await sendPushNotification(recipientId, `Nuevo mensaje de ${sender?.name || 'Alguien'}`, content.substring(0, 100), {
        type: 'NEW_MESSAGE',
        chat_id: chatId,
        message_id: message.message_id,
      });
    }
  } catch (error) {
    log.error('Socket/Push error:', error);
  }

  return formattedMessage;
}

/**
 * Marks all unread messages in a chat as read for a specific user
 * @param {string} chatId
 * @param {string} userId
 * @returns {Promise<object>} Update result
 */
export async function markMessagesAsRead(chatId, userId) {
  const chat = await verifyChatAccess(chatId, userId);

  // Delegate to message service
  const result = await messageService.markMessagesAsRead(chatId, userId);

  // Socket orchestration: notify the other user
  if (result.count > 0) {
    try {
      const io = getIO();
      const recipientId = getRecipientId(chat, userId);

      io.to(recipientId).emit('messages_read', {
        chat_id: chatId,
        read_by: userId,
      });
    } catch (error) {
      log.error('Socket emit error:', error);
    }
  }

  return result;
}

/**
 * Get messages for a specific chat with pagination
 * @param {string} chatId
 * @param {string} userId
 * @param {number} limit
 * @param {string|null} before - Message ID cursor
 * @returns {Promise<Array>} Formatted messages
 */
export async function getChatMessages(chatId, userId, limit = 50, before = null) {
  await verifyChatAccess(chatId, userId);

  // Delegate to message service
  const messages = await messageService.getMessagesByChatId(chatId, limit, before);

  // Mark undelivered messages as delivered (async, non-blocking)
  const undeliveredMessageIds = messages.filter((m) => m.sender_id !== userId && !m.delivered).map((m) => m.message_id);

  if (undeliveredMessageIds.length > 0) {
    messageService.markMessagesAsDelivered(undeliveredMessageIds).catch((err) => log.error('Error marking messages as delivered:', err));
  }

  return messages.map(formatMessage);
}

/**
 * Deletes a message if it's within the 5-minute window
 * @param {string} messageId
 * @param {string} userId
 * @returns {Promise<object>} Formatted deleted message
 */
export async function deleteMessage(messageId, userId) {
  const message = await messageService.getMessageById(messageId);

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND');
  }

  if (message.sender_id !== userId) {
    throw new Error('NOT_MESSAGE_OWNER');
  }

  const diffMinutes = (new Date() - new Date(message.created_at)) / 1000 / 60;

  if (diffMinutes > 5) {
    throw new Error('DELETE_TIME_EXPIRED');
  }

  // Delegate soft delete to message service
  const updatedMessage = await messageService.softDeleteMessage(messageId);

  return formatMessage(updatedMessage);
}

// Export formatChat for controller use
export { formatChat };
