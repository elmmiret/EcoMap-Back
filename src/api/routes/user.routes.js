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
  getAllUserIds,
  getAllClientIds,
  getAllInstitutionIds,
  getAllAdminIds,
  getUserById,
  getUserTypeById,
  getUserPublicData,
  getUserPrivateData,
  getUserValorationsMade,
  getUserValorationsReceived,
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
 * @route GET /api/users/:userId/public
 * @description Obtiene datos públicos de un usuario específico.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.get('/:id/public', authenticateBackendJWT, getUserPublicData);

/**
 * @route GET /api/users/:userId/private
 * @description Obtiene datos privados de un usuario específico.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.get('/:id/private', authenticateBackendJWT, getUserPrivateData);

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
 * @route GET /api/users/ids/all
 * @description Obtiene IDs de todos los usuarios registrados
 */
router.get('/ids/all', authenticateBackendJWT, getAllUserIds);

/**
 * @route GET /api/users/ids/clients
 * @description Obtiene IDs de todos los clientes
 */
router.get('/ids/clients', authenticateBackendJWT, getAllClientIds);

/**
 * @route GET /api/users/ids/institutions
 * @description Obtiene IDs de todas las instituciones
 */
router.get('/ids/institutions', authenticateBackendJWT, getAllInstitutionIds);

/**
 * @route GET /api/users/ids/admins
 * @description Obtiene IDs de todos los administradores
 */
router.get('/ids/admins', authenticateBackendJWT, getAllAdminIds);

/**
 * @route GET /api/users/:id/type
 * @description Obtiene el tipo (rol) de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/type', authenticateBackendJWT, getUserTypeById);

/**
 * @route GET /api/users/:id/valorations/made
 * @description Obtiene las valoraciones escritas por el usuario.
 */
router.get('/:id/valorations/made', authenticateBackendJWT, getUserValorationsMade);

/**
 * @route GET /api/users/:id/valorations/received
 * @description Obtiene las valoraciones recibidas por el usuario (su reputación).
 */
router.get('/:id/valorations/received', authenticateBackendJWT, getUserValorationsReceived);

/**
 * @route GET /api/users/:id
 * @description Obtiene la información pública de un usuario específico.
 */
router.get('/:id', authenticateBackendJWT, getUserById);

export default router;
