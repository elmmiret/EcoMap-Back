// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
import express from 'express';
const router = express.Router();

import { authenticateUser, authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { syncUserToPostgres, logoutUser, deleteUser, getUserProfile } from '#controllers/user.controller.js';

/**
 * @route POST /api/users/sync
 * @description Sincroniza un usuario autenticado desde Firebase con PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.post('/sync', authenticateUser, syncUserToPostgres);

/**
 * @route GET /api/users/me
 * @description Obtiene el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.get('/me', authenticateBackendJWT, getUserProfile);

/**
 * @route POST /api/users/logout
 * @description Elimina la sesión del usuario autenticado de PostgreSQL.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.post('/logout', authenticateBackendJWT, logoutUser);

/**
 * @route DELETE /api/users/me
 * @description Elimina el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con token de Firebase y sesión reciente)
 */
router.delete('/me', authenticateUser, deleteUser);

export default router;
