// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
import express from 'express';
const router = express.Router();

import { requireRoleSecret } from '#middlewares/role.middleware.js';
import { authenticateUser, authenticateBackendJWT, requireAdmin } from '#middlewares/auth.middleware.js';
import { validatePhone } from '#middlewares/validation.middleware.js';
import { uploadImageMiddleware } from '#middlewares/upload.middleware.js';
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
  getUserFullProfile,
  getUserTypeById,
  getUserPublicData,
  getUserValorationsMade,
  getUserValorationsReceived,
  getUserScore,
  getMyRewardsBought,
  getUserRewardsBoughtById,
  getUserPoints,
  addUserToBlockedList,
  getUserBlockedList,
  reportUser,
  getAllUserReports,
  updateReportStatus,
  deleteReport,
  getReportsByStatus,
  getReportById,
  createUserByAdmin,
  blockUser,
  unblockUser,
  getUserBlockStatus,
  getDashboardStats,
} from '#controllers/user.controller.js';

/**
 * @route POST /api/users/sync
 * @description Sincroniza un usuario autenticado desde Firebase con PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.post('/sync', authenticateUser, uploadImageMiddleware, requireRoleSecret, syncUserToPostgres);

/**
 * @route GET /api/users/me
 * @description Obtiene el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.get('/me', authenticateBackendJWT, getUserProfile);

/**
 * @route POST /api/users/block/:userId
 * @description Bloquea a un usuario específico añadiéndolo a la lista de bloqueados.
 * @access Protegido
 */
router.post('/block/:userId', authenticateBackendJWT, addUserToBlockedList);

/**
 * @route GET /api/users/admin/block/:userId
 * @description Devuelve los IDs de los usuarios bloqueados por :userId (Solo Admin).
 */
router.get('/admin/block/:userId', authenticateBackendJWT, getUserBlockedList);

/**
 * @route GET /api/users/admin/reports
 * @description Obtiene todos los reportes de usuarios (Solo Admin).
 */
router.get('/admin/reports', authenticateBackendJWT, getAllUserReports);

/**
 * @route PATCH /api/users/admin/reports/:reportId
 * @description Actualiza el estado de un reporte específico (Solo Admin).
 */
router.patch('/admin/reports/:reportId', authenticateBackendJWT, updateReportStatus);

/**
 * @route DELETE /api/users/admin/reports/:reportId
 * @description Elimina un reporte de usuario (Solo Admin).
 */
router.delete('/admin/reports/:reportId', authenticateBackendJWT, deleteReport);

/**
 * @route GET /api/users/admin/reports/status/:status
 * @description Obtiene reportes filtrados por estado (Pending, Resolved, Dismissed).
 * @access Protegido (Solo Admin)
 * @example GET /api/users/admin/reports/status/pending
 */
router.get('/admin/reports/status/:status', authenticateBackendJWT, getReportsByStatus);

/**
 * @route GET /api/users/admin/reports/detail/:reportId
 * @description Obtiene el detalle de un reporte específico.
 * @access Protegido (Solo Admin)
 */
router.get('/admin/reports/detail/:reportId', authenticateBackendJWT, getReportById);

/**
 * @route POST /api/users/admin/create
 * @description Crea un nuevo usuario (cliente o institución) desde el dashboard de admin.
 * @access Protegido (Solo Admin con secret key)
 */
router.post('/admin/create', authenticateBackendJWT, requireRoleSecret, createUserByAdmin);

/**
 * @route POST /api/users/admin/account/block/:userId
 * @description Bloquea la cuenta de un usuario para que no pueda hacer login.
 * @access Protegido (Solo Admin)
 */
router.post('/admin/account/block/:userId', authenticateBackendJWT, requireAdmin, blockUser);

/**
 * @route POST /api/users/admin/account/unblock/:userId
 * @description Desbloquea la cuenta de un usuario.
 * @access Protegido (Solo Admin)
 */
router.post('/admin/account/unblock/:userId', authenticateBackendJWT, requireAdmin, unblockUser);

/**
 * @route GET /api/users/admin/account/status/:userId
 * @description Obtiene el estado de bloqueo de una cuenta.
 * @access Protegido (Solo Admin)
 */
router.get('/admin/account/status/:userId', authenticateBackendJWT, requireAdmin, getUserBlockStatus);

/**
 * @route GET /api/users/admin/dashboard/stats
 * @description Obtiene estadísticas generales para el dashboard de administración.
 * @access Protegido (Solo Admin)
 */
router.get('/admin/dashboard/stats', authenticateBackendJWT, requireAdmin, getDashboardStats);

/**
 * @route POST /api/users/report/:userId
 * @description Crea un reporte contra un usuario.
 */
router.post('/report/:userId', authenticateBackendJWT, reportUser);

/**
 * @route GET /api/users/me/rewards_bought
 * @description Obtiene el historial de rewards comprados por el usuario actual.
 * @access Protegido
 */
router.get('/me/rewards_bought', authenticateBackendJWT, getMyRewardsBought);

/**
 * @route GET /api/users/:userId/points
 * @description Devuelve la cantidad de puntos de un cliente específico.
 * @access Protegido
 */
router.get('/:userId/points', authenticateBackendJWT, getUserPoints);

/**
 * @route PUT /api/users/me
 * @description Actualiza el perfil del usuario autenticado.
 * @access Protegido (requiere autenticación con JWT del backend)
 */
router.put('/me', authenticateBackendJWT, validatePhone, uploadImageMiddleware, updateUserProfile);

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
 * @route GET /api/users/:userId/rewards_bought
 * @description Obtiene el historial de rewards comprados por un usuario específico.
 * @access Protegido
 */
router.get('/:userId/rewards_bought', authenticateBackendJWT, getUserRewardsBoughtById);

/**
 * @route GET /api/users/:id/score
 * @description Obtiene la puntuación media de valoraciones de un usuario.
 */
router.get('/:id/score', authenticateBackendJWT, getUserScore);

/**
 * @route GET /api/users/:id/public
 * @description Obtiene datos públicos no sensibles de un usuario.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/public', authenticateBackendJWT, getUserPublicData);

/**
 * @route GET /api/users/:userId
 * @description Obtiene TODA la información de un usuario registrado por su ID.
 * @access Protegido
 */
router.get('/:userId', authenticateBackendJWT, getUserFullProfile);

export default router;
