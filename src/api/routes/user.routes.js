// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
import express from 'express';
const router = express.Router();

import { authenticateUser } from '../middleware/auth.js'; // ruta relativa a api/routes
import { 
    syncUserToPostgres, 
    deleteUserFromPostgres
} from '../controllers/user.controller.js'; //ruta relativa a api/routes

/**
 * @route POST /api/users/sync
 * @description Sincroniza un usuario autenticado desde Firebase con PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.post('/sync', authenticateUser, syncUserToPostgres);

/**
 * @route DELETE /api/users/logout
 * @description Elimina el usuario autenticado de Firebase y de PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.delete('/logout', authenticateUser, deleteUserFromPostgres);

export default router;
