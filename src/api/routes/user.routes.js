// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
import express from 'express';
const router = express.Router();

import { authenticateUser, authenticateBackendJWT } from '../middlewares/auth.middleware.js'; // ruta relativa a api/routes
import { syncUserToPostgres, logoutUser, deleteUserFromPostgres } from '../controllers/user.controller.js'; //ruta relativa a api/routes

/**
 * @route POST /api/users/sync
 * @description Sincroniza un usuario autenticado desde Firebase con PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.post('/sync', authenticateUser, syncUserToPostgres);

/**
 * @route POST /api/users/logout
 * @description Elimina la sesión del usuario autenticado de PostgreSQL.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.post('/logout', authenticateBackendJWT, logoutUser);

/**
 * @route DELETE /api/users/me
 * @description Elimina el usuario autenticado de Firebase y de PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.delete('/me', authenticateUser, deleteUserFromPostgres);

export default router;
