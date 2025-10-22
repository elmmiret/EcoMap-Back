import { verifyIdToken } from '../../services/auth.service.js';

/**
 * Handles user login by verifying Firebase ID token
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const login = async (req, res) => {
  try {
    const { idToken } = req.body;

    // Validate token presence
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await verifyIdToken(idToken);

    // TODO: Optional - Check if user exists in your database
    // const user = await findUserByFirebaseUid(decodedToken.uid);
    // if (!user) {
    //   // Create user in your database if first login
    //   await createUserFromFirebase(decodedToken);
    // }

    // Return user info
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.emailVerified,
        name: decodedToken.name,
        picture: decodedToken.picture,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);

    // Handle specific error cases
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.message.includes('Invalid token')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN',
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};
