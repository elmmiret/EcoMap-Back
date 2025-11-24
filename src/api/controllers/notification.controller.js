import { registerDeviceToken } from '#services/notification.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('notification-controller');

/**
 * Registers a device token for push notifications
 */
export const saveToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.uid;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required',
                code: 'MISSING_TOKEN',
            });
        }

        await registerDeviceToken(userId, token);

        res.status(200).json({
            success: true,
            message: 'Device token registered successfully',
        });
    } catch (error) {
        log.error('Error registering device token:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR',
        });
    }
};
