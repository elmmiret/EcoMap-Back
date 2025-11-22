// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
import express from 'express';
const router = express.Router();

import { authenticateUser, authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { validatePhone } from '#middlewares/validation.middleware.js';
import { 
    syncUserToPostgres, 
    changeAppLanguage, 
    logoutUser, 
    getUserProfile, 
    deleteUser, 
    updateUserProfile,
    getUserById
} from '#controllers/user.controller.js';

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
 * @route PUT /api/users/me
 * @description Actualiza el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.put('/me', authenticateBackendJWT, validatePhone, updateUserProfile);

/**
 * @route DELETE /api/users/me
 * @description Elimina el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con token de Firebase y sesión reciente)
 */
router.delete('/me', authenticateBackendJWT, deleteUser);

/**
 * @route POST /api/users/logout
 * @description Elimina la sesión del usuario autenticado de PostgreSQL.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.post('/logout', authenticateBackendJWT, logoutUser);

/**
 * @route PUT /api/users/language
 * @description Actualiza el idioma de la aplicación del usuario
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.put('/language', authenticateBackendJWT, changeAppLanguage);

/**
 * @route GET /api/users/:id
 * @description Obtiene la información pública de un usuario específico por su ID.
 * @access Protegido (Backend JWT)
 */
router.get('/:id', authenticateBackendJWT, getUserById);

export default router;
