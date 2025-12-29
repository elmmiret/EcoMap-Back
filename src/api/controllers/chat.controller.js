import {
  createOrGetChat,
  getUserChats,
  sendMessage,
  markMessagesAsRead,
  getChatMessages,
  deleteMessage,
  formatChat,
} from '#services/chat.service.js';
import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('chat-controller');

export const startChat = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: 'MISSING_USERNAME' });
    }

    // Find target user by username
    const targetUser = await prisma.registered_user.findUnique({
      where: { username },
      select: { user_id: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
    }

    const targetUserId = targetUser.user_id;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, error: 'CANNOT_CHAT_WITH_SELF' });
    }

    const chat = await createOrGetChat(userId, targetUserId);
    // Format the chat before returning
    const formattedChat = formatChat(chat, userId);

    return res.status(201).json({ success: true, chat: formattedChat });
  } catch (error) {
    log.error('Error starting chat:', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const listChats = async (req, res) => {
  const { uid } = req.user;

  try {
    // obtener mi propia lista de usuarios bloqueados
    const currentUser = await prisma.registered_user.findUnique({
      where: { user_id: uid },
      select: { blocked_users: true },
    });

    const myBlockedUsers = currentUser?.blocked_users || [];

    // obtener todos los chats donde participo
    const chats = await prisma.chat.findMany({
      where: {
        OR: [{ user1_id: uid }, { user2_id: uid }],
      },
      include: {
        // Incluimos datos del usuario 1
        user1: {
          include: {
            registered_user: {
              select: {
                user_id: true,
                username: true,
                name: true,
                surname: true,
                profile_picture: true,
                blocked_users: true, // Necesario para saber si ME bloquearon
              },
            },
          },
        },
        // Incluimos datos del usuario 2
        user2: {
          include: {
            registered_user: {
              select: {
                user_id: true,
                username: true,
                name: true,
                surname: true,
                profile_picture: true,
                blocked_users: true, // Necesario para saber si ME bloquearon
              },
            },
          },
        },
        // Incluimos el último mensaje para la previsualización
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' }, // Ordenar por creación del chat (o podrías ordenar por último mensaje)
    });

    // 3. Filtrar y Formatear
    const validChats = [];

    for (const chat of chats) {
      // Determinar quién es el "otro" usuario
      const isUser1 = chat.user1_id === uid;
      const otherParticipant = isUser1 ? chat.user2 : chat.user1;

      // Datos del otro usuario (registered_user)
      const otherUserReg = otherParticipant.registered_user;

      // --- LÓGICA DE BLOQUEO ---

      // A. ¿Yo lo he bloqueado?
      if (myBlockedUsers.includes(otherUserReg.user_id)) {
        continue; // Saltamos este chat
      }

      // B. ¿Él me ha bloqueado?
      if (otherUserReg.blocked_users && otherUserReg.blocked_users.includes(uid)) {
        continue; // Saltamos este chat (invisible para ambos)
      }

      // Si pasa los filtros, lo formateamos para la respuesta
      validChats.push({
        chat_id: chat.chat_id,
        created_at: chat.created_at,
        other_user: {
          uid: otherUserReg.user_id,
          username: otherUserReg.username,
          name: `${otherUserReg.name} ${otherUserReg.surname || ''}`.trim(),
          profile_picture: otherUserReg.profile_picture,
        },
        last_message:
          chat.messages.length > 0
            ? {
                content: chat.messages[0].content,
                sender_id: chat.messages[0].sender_id,
                created_at: chat.messages[0].created_at,
                read: chat.messages[0].read,
              }
            : null,
      });
    }

    // ordenar
    validChats.sort((a, b) => {
      const dateA = a.last_message ? new Date(a.last_message.created_at) : new Date(a.created_at);
      const dateB = b.last_message ? new Date(b.last_message.created_at) : new Date(b.created_at);
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      count: validChats.length,
      data: validChats,
    });
  } catch (error) {
    console.error('Error listando chats:', error);
    return res.status(500).json({ success: false, message: 'Error interno al obtener chats.' });
  }
};

export const postMessage = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { chatId } = req.params;
    const { content, media } = req.body;

    const hasContent = content && typeof content === 'string' && content.trim().length > 0;
    const hasMedia = Array.isArray(media) && media.length > 0;

    if (!hasContent && !hasMedia) {
      return res.status(400).json({ success: false, error: 'INVALID_CONTENT_OR_MEDIA' });
    }

    const finalContent = hasContent ? content : '';
    const mediaUrls = hasMedia ? media : [];

    const message = await sendMessage(chatId, userId, finalContent, mediaUrls);
    return res.status(201).json({ success: true, message });
  } catch (error) {
    log.error('Error sending message:', error);
    if (error.message === 'CHAT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'CHAT_NOT_FOUND' });
    }
    if (error.message === 'USER_NOT_IN_CHAT') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const markRead = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { chatId } = req.params;

    await markMessagesAsRead(chatId, userId);
    return res.json({ success: true });
  } catch (error) {
    log.error('Error marking messages read:', error);
    if (error.message === 'CHAT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'CHAT_NOT_FOUND' });
    }
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { chatId } = req.params;
    const { limit, before } = req.query;

    const messages = await getChatMessages(chatId, userId, limit ? parseInt(limit) : undefined, before);
    return res.json({ success: true, messages });
  } catch (error) {
    log.error('Error getting messages:', error);
    if (error.message === 'CHAT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'CHAT_NOT_FOUND' });
    }
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const removeMessage = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { messageId } = req.params;

    const message = await deleteMessage(messageId, userId);
    return res.json({ success: true, message });
  } catch (error) {
    log.error('Error deleting message:', error);
    if (error.message === 'MESSAGE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'MESSAGE_NOT_FOUND' });
    }
    if (error.message === 'NOT_MESSAGE_OWNER') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }
    if (error.message === 'DELETE_TIME_EXPIRED') {
      return res.status(400).json({ success: false, error: 'DELETE_TIME_EXPIRED' });
    }
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};
