// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
const express = require('express');
const router = express.Router();

const { authenticateUser } = require('../middleware/auth'); // ruta relativa a api/routes
const { syncUserToPostgres } = require('../controllers/user.controller'); //ruta relativa a api/routes

/**
 * @route POST /api/users/sync
 * @description Sincroniza un usuario autenticado desde Firebase con PostgreSQL.
 * @access Protegido (requiere autenticación con token de Firebase)
 */
router.post('/sync', authenticateUser, syncUserToPostgres);

module.exports = router;