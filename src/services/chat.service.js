import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';
import { getIO, isUserConnected } from './socket.service.js';
import { sendPushNotification } from './notification.service.js';

const log = createLogger('chat-service');

/**
 * Creates a new chat or returns an existing one between two users.
 * Ensures consistent ordering of user IDs to maintain uniqueness.
 * @param {string} user1Id
 * @param {string} user2Id
 * @returns {Promise<object>} The chat object
 */
export async function createOrGetChat(user1Id, user2Id) {
  // Ensure consistent ordering to match the unique constraint [user1_id, user2_id]
  const [u1, u2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

  // Check if chat exists
  const existingChat = await prisma.chat.findUnique({
    where: {
      user1_id_user2_id: {
        user1_id: u1,
        user2_id: u2,
      },
    },
  });

  if (existingChat) {
    return existingChat;
  }

  // Create new chat
  return prisma.chat.create({
    data: {
      user1_id: u1,
      user2_id: u2,
    },
  });
}

/**
 * Retrieves all chats for a specific user, including the last message and unread count.
 * @param {string} userId
 * @returns {Promise<Array>} List of chats
 */
export async function getUserChats(userId) {
  const chats = await prisma.chat.findMany({
    where: {
      OR: [
        { user1_id: userId },
        { user2_id: userId },
      ],
    },
    include: {
      user1: {
        select: {
          user_id: true,
          registered_user: {
            select: { name: true, username: true, email: true },
          },
          profile_picture: true,
        },
      },
      user2: {
        select: {
          user_id: true,
          registered_user: {
            select: { name: true, username: true, email: true },
          },
          profile_picture: true,
        },
      },
      messages: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
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
    orderBy: {
      updated_at: 'desc',
    },
  });

  // Transform result to be friendlier for the frontend
  return chats.map(chat => {
    const otherUser = chat.user1_id === userId ? chat.user2 : chat.user1;
    const lastMessage = chat.messages[0] || null;

    return {
      chat_id: chat.chat_id,
      other_user: {
        user_id: otherUser.user_id,
        name: otherUser.registered_user.name,
        username: otherUser.registered_user.username,
        profile_picture: otherUser.profile_picture,
      },
      last_message: lastMessage,
      unread_count: chat._count.messages,
      updated_at: chat.updated_at,
    };
  });
}

/**
 * Sends a message in a chat.
 * @param {string} chatId
 * @param {string} senderId
 * @param {string} content
 * @returns {Promise<object>} The created message
 */
export async function sendMessage(chatId, senderId, content) {
  // Verify sender is part of the chat
  const chat = await prisma.chat.findUnique({
    where: { chat_id: chatId },
  });

  if (!chat) {
    throw new Error('CHAT_NOT_FOUND');
  }

  if (chat.user1_id !== senderId && chat.user2_id !== senderId) {
    throw new Error('USER_NOT_IN_CHAT');
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      chat_id: chatId,
      sender_id: senderId,
      content: content,
    },
  });

  // Update chat's updated_at
  await prisma.chat.update({
    where: { chat_id: chatId },
    data: { updated_at: new Date() },
  });

  // Emit socket event
  try {
    const io = getIO();
    const recipientId = chat.user1_id === senderId ? chat.user2_id : chat.user1_id;

    io.to(recipientId).emit('new_message', {
      chat_id: chatId,
      message: message,
    });

    // Also emit to sender (optional, but good for multi-device)
    io.to(senderId).emit('new_message', {
      chat_id: chatId,
      message: message,
    });

    // Send Push Notification if user is NOT connected
    if (!isUserConnected(recipientId)) {
      // Get sender name for the notification
      const sender = await prisma.registered_user.findUnique({
        where: { user_id: senderId },
        select: { name: true }
      });

      await sendPushNotification(
        recipientId,
        `Nuevo mensaje de ${sender?.name || 'Alguien'}`,
        content.substring(0, 100), // Truncate body
        {
          type: 'NEW_MESSAGE',
          chat_id: chatId,
          message_id: message.message_id
        }
      );
    }

  } catch (error) {
    log.error('Socket/Push error:', error);
  }

  return message;
}

/**
 * Marks all unread messages in a chat as read for a specific user.
 * @param {string} chatId
 * @param {string} userId - The user who is reading the messages (so we mark messages NOT sent by them)
 */
export async function markMessagesAsRead(chatId, userId) {
  // Verify user is in chat
  const chat = await prisma.chat.findUnique({
    where: { chat_id: chatId },
  });

  if (!chat) {
    throw new Error('CHAT_NOT_FOUND');
  }

  if (chat.user1_id !== userId && chat.user2_id !== userId) {
    throw new Error('USER_NOT_IN_CHAT');
  }

  // Update messages where sender is NOT the user
  const result = await prisma.message.updateMany({
    where: {
      chat_id: chatId,
      sender_id: { not: userId },
      is_read: false,
    },
    data: {
      is_read: true,
    },
  });

  // Emit socket event
  if (result.count > 0) {
    try {
      const io = getIO();
      const recipientId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;

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
 * Marks a specific message as delivered.
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
 * Get messages for a specific chat with pagination
 * @param {string} chatId 
 * @param {string} userId 
 * @param {number} limit 
 * @param {string} before - Cursor for pagination (message_id)
 */
export async function getChatMessages(chatId, userId, limit = 50, before = null) {
  // Verify user is in chat
  const chat = await prisma.chat.findUnique({
    where: { chat_id: chatId },
  });

  if (!chat) {
    throw new Error('CHAT_NOT_FOUND');
  }

  if (chat.user1_id !== userId && chat.user2_id !== userId) {
    throw new Error('USER_NOT_IN_CHAT');
  }

  const query = {
    where: { chat_id: chatId },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      sender: {
        select: {
          user_id: true,
          registered_user: {
            select: { username: true }
          }
        }
      }
    }
  };

  if (before) {
    query.cursor = { message_id: before };
    query.skip = 1;
  }

  const messages = await prisma.message.findMany(query);

  // Mark messages as delivered if they are not from the current user and not yet delivered
  // We do this asynchronously to not block the response
  const undeliveredMessageIds = messages
    .filter(m => m.sender_id !== userId && !m.delivered)
    .map(m => m.message_id);

  if (undeliveredMessageIds.length > 0) {
    prisma.message.updateMany({
      where: { message_id: { in: undeliveredMessageIds } },
      data: { delivered: true }
    }).catch(err => log.error('Error marking messages as delivered:', err));
  }

  return messages;
}
