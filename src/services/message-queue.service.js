import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';
import { getIO, isUserConnected } from './socket.service.js';
import { sendPushNotification } from './notification.service.js';

const log = createLogger('message-queue-service');

// Configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds
// const MESSAGE_TIMEOUT_MS = 30000; // 30 seconds (not used here, defined in chat.service.js)
const QUEUE_CHECK_INTERVAL_MS = 5000; // Check queue every 5 seconds

// In-memory queue for pending messages
const messageQueue = new Map();
let queueTimer = null;

/**
 * Starts the message queue processor
 */
export function startMessageQueue() {
  if (queueTimer) {
    log.warn('Message queue already running');
    return;
  }

  log.info('Starting message queue processor');
  queueTimer = setInterval(processQueue, QUEUE_CHECK_INTERVAL_MS);

  // Process immediately on start
  processQueue();
}

/**
 * Stops the message queue processor
 */
export function stopMessageQueue() {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
    log.info('Message queue processor stopped');
  }
}

/**
 * Adds a message to the retry queue
 * @param {string} messageId
 * @param {object} messageData
 */
export function enqueueMessage(messageId, messageData) {
  messageQueue.set(messageId, {
    ...messageData,
    addedAt: Date.now(),
    nextRetryAt: Date.now() + RETRY_DELAY_MS,
  });
  log.info(`Message ${messageId} added to retry queue`);
}

/**
 * Removes a message from the retry queue
 * @param {string} messageId
 */
export function dequeueMessage(messageId) {
  const removed = messageQueue.delete(messageId);
  if (removed) {
    log.info(`Message ${messageId} removed from retry queue`);
  }
  return removed;
}

/**
 * Gets queue statistics
 */
export function getQueueStats() {
  return {
    queueSize: messageQueue.size,
    messages: Array.from(messageQueue.entries()).map(([id, data]) => ({
      messageId: id,
      chatId: data.chatId,
      retryCount: data.retryCount || 0,
      addedAt: data.addedAt,
      nextRetryAt: data.nextRetryAt,
    })),
  };
}

/**
 * Processes the message queue
 */
async function processQueue() {
  if (messageQueue.size === 0) {
    return;
  }

  const now = Date.now();
  const messagesToProcess = [];

  // Find messages ready for retry
  for (const [messageId, data] of messageQueue.entries()) {
    if (data.nextRetryAt <= now) {
      messagesToProcess.push({ messageId, data });
    }
  }

  if (messagesToProcess.length === 0) {
    return;
  }

  log.info(`Processing ${messagesToProcess.length} messages from queue`);

  for (const { messageId, data } of messagesToProcess) {
    try {
      await retryMessage(messageId, data);
    } catch (error) {
      log.error(`Error processing message ${messageId}:`, error);
    }
  }
}

/**
 * Retries sending a message
 * @param {string} messageId
 * @param {object} data
 */
async function retryMessage(messageId, data) {
  const { chatId, senderId, content, retryCount = 0 } = data;

  try {
    // Check if message still exists and is in PENDING or FAILED state
    const message = await prisma.message.findUnique({
      where: { message_id: messageId },
      include: { message_media: true },
    });

    if (!message) {
      log.warn(`Message ${messageId} not found, removing from queue`);
      dequeueMessage(messageId);
      return;
    }

    if (message.status !== 'PENDING' && message.status !== 'FAILED') {
      log.info(`Message ${messageId} already processed (status: ${message.status}), removing from queue`);
      dequeueMessage(messageId);
      return;
    }

    // Attempt to send via socket
    const io = getIO();
    const chat = await prisma.chat.findUnique({
      where: { chat_id: chatId },
    });

    if (!chat) {
      throw new Error('CHAT_NOT_FOUND');
    }

    const recipientId = chat.user1_id === senderId ? chat.user2_id : chat.user1_id;

    // Check if recipient is online
    if (isUserConnected(recipientId)) {
      // Update message status to SENT
      const updatedMessage = await prisma.message.update({
        where: { message_id: messageId },
        data: {
          status: 'SENT',
          retry_count: retryCount + 1,
          last_error: null,
        },
        include: { message_media: true },
      });

      // Emit to recipient
      io.to(recipientId).emit('new_message', {
        chat_id: chatId,
        message: formatMessageForSocket(updatedMessage),
      });

      // Emit to sender
      io.to(senderId).emit('message_status_updated', {
        message_id: messageId,
        status: 'SENT',
      });

      log.info(`Message ${messageId} successfully sent on retry ${retryCount + 1}`);
      dequeueMessage(messageId);
    } else {
      // Recipient offline, send push notification
      const sender = await prisma.registered_user.findUnique({
        where: { user_id: senderId },
        select: { name: true },
      });

      await sendPushNotification(recipientId, `Nuevo mensaje de ${sender?.name || 'Alguien'}`, content.substring(0, 100), {
        type: 'NEW_MESSAGE',
        chat_id: chatId,
        message_id: messageId,
      });

      // Mark as SENT (push notification sent)
      await prisma.message.update({
        where: { message_id: messageId },
        data: {
          status: 'SENT',
          retry_count: retryCount + 1,
          last_error: null,
        },
      });

      io.to(senderId).emit('message_status_updated', {
        message_id: messageId,
        status: 'SENT',
      });

      log.info(`Message ${messageId} sent via push notification on retry ${retryCount + 1}`);
      dequeueMessage(messageId);
    }
  } catch (error) {
    log.error(`Retry attempt ${retryCount + 1} failed for message ${messageId}:`, error);

    const newRetryCount = retryCount + 1;

    if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
      // Max retries reached, mark as FAILED
      await prisma.message.update({
        where: { message_id: messageId },
        data: {
          status: 'FAILED',
          retry_count: newRetryCount,
          last_error: error.message || 'Unknown error',
        },
      });

      // Notify sender
      try {
        const io = getIO();
        io.to(data.senderId).emit('message_status_updated', {
          message_id: messageId,
          status: 'FAILED',
          error: 'MAX_RETRIES_EXCEEDED',
        });
      } catch (socketError) {
        log.error('Error notifying sender of failure:', socketError);
      }

      log.error(`Message ${messageId} failed after ${newRetryCount} attempts`);
      dequeueMessage(messageId);
    } else {
      // Schedule next retry
      await prisma.message.update({
        where: { message_id: messageId },
        data: {
          retry_count: newRetryCount,
          last_error: error.message || 'Unknown error',
        },
      });

      messageQueue.set(messageId, {
        ...data,
        retryCount: newRetryCount,
        nextRetryAt: Date.now() + RETRY_DELAY_MS * Math.pow(2, newRetryCount), // Exponential backoff
      });

      log.info(`Message ${messageId} scheduled for retry ${newRetryCount + 1}`);
    }
  }
}

/**
 * Formats a message for socket emission
 * @param {object} message
 */
function formatMessageForSocket(message) {
  return {
    message_id: message.message_id,
    chat_id: message.chat_id,
    sender_id: message.sender_id,
    content: message.is_deleted ? 'Mensaje eliminado' : message.content,
    media: message.is_deleted ? [] : message.message_media?.map((m) => m.media_url) || [],
    status: message.status,
    created_at: message.created_at,
    is_deleted: message.is_deleted,
  };
}

/**
 * Recovers pending messages from database on startup
 */
export async function recoverPendingMessages() {
  try {
    const pendingMessages = await prisma.message.findMany({
      where: {
        OR: [{ status: 'PENDING' }, { status: 'FAILED' }],
        retry_count: { lt: MAX_RETRY_ATTEMPTS },
      },
      include: {
        message_media: true,
        chat: true,
      },
    });

    log.info(`Recovering ${pendingMessages.length} pending messages`);

    for (const message of pendingMessages) {
      enqueueMessage(message.message_id, {
        chatId: message.chat_id,
        senderId: message.sender_id,
        content: message.content,
        mediaUrls: message.message_media?.map((m) => m.media_url) || [],
        retryCount: message.retry_count,
      });
    }
  } catch (error) {
    log.error('Error recovering pending messages:', error);
  }
}
