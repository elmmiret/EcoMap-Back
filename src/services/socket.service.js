import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createLogger } from '#lib/logger.js';
import { markMessageAsDelivered } from './message.service.js';

const log = createLogger('socket-service');
let io;

/**
 * Initialize Socket.io with the HTTP server
 * @param {object} httpServer
 */
export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      log.error('Error verifying token:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    log.info(`User connected: ${socket.user.uid}`);

    // Join user to their own room for personal notifications
    socket.join(socket.user.uid);

    // Handle message delivery confirmation
    socket.on('message_received', async (data) => {
      try {
        const { message_id } = data;
        if (message_id) {
          const updatedMessage = await markMessageAsDelivered(message_id);

          // Notify the sender that the message was delivered
          if (updatedMessage && updatedMessage.sender_id) {
            io.to(updatedMessage.sender_id).emit('message_delivered', {
              chat_id: updatedMessage.chat_id,
              message_id: updatedMessage.message_id,
              delivered: true,
            });
          }
        }
      } catch (error) {
        log.error('Error handling message_received:', error);
      }
    });

    socket.on('disconnect', () => {
      log.info(`User disconnected: ${socket.user.uid}`);
    });
  });

  return io;
}

/**
 * Get the initialized IO instance
 * @returns {Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/**
 * Checks if a user is currently connected via socket.
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserConnected(userId) {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(userId);
  return !!room && room.size > 0;
}
