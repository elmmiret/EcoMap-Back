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
  try {
    const userId = req.user.uid;
    const chats = await getUserChats(userId);
    return res.json({ success: true, chats });
  } catch (error) {
    log.error('Error listing chats:', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const postMessage = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'INVALID_CONTENT' });
    }

    const message = await sendMessage(chatId, userId, content);
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
