import express from 'express';
import { authenticateBackendJWT, requireClient } from '#middlewares/auth.middleware.js';
import { startChat, listChats, postMessage, markRead, getMessages, removeMessage } from '#controllers/chat.controller.js';

import { chatMessageLimiter } from '#middlewares/rate-limit.middleware.js';
import { validateChatMessage } from '#middlewares/chat.middleware.js';

const router = express.Router();

/**
 * @route GET /api/chats
 * @description List all chats for the authenticated user
 * @access Protected (Client only)
 */
router.get('/', authenticateBackendJWT, requireClient, listChats);

/**
 * @route POST /api/chats
 * @description Start a new chat or get existing one
 * @body { username: string }
 * @access Protected (Client only)
 */
router.post('/', authenticateBackendJWT, requireClient, startChat);

/**
 * @route GET /api/chats/:chatId/messages
 * @description Get messages for a chat
 * @query { limit: number, before: string }
 * @access Protected (Client only)
 */
router.get('/:chatId/messages', authenticateBackendJWT, requireClient, getMessages);

/**
 * @route POST /api/chats/:chatId/messages
 * @description Send a message to a chat
 * @body { content: string, media: string[] }
 * @access Protected (Client only)
 */
router.post('/:chatId/messages', authenticateBackendJWT, requireClient, chatMessageLimiter, validateChatMessage, postMessage);

/**
 * @route PUT /api/chats/:chatId/read
 * @description Mark all messages in a chat as read
 * @access Protected (Client only)
 */
router.put('/:chatId/read', authenticateBackendJWT, requireClient, markRead);

/**
 * @route DELETE /api/chats/messages/:messageId
 * @description Delete a message (soft delete)
 * @access Protected (Client only)
 */
router.delete('/messages/:messageId', authenticateBackendJWT, requireClient, removeMessage);

export default router;
