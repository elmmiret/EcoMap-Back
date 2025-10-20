// DEFINE LAS RUTAS Y LLAMA AL CONTROLADOR
const express = require('express');
const router = express.Router();

const { authenticateUser } = require('..middleware/auth'); // ruta relativa a api/routes
const { syncUserToPostgres } = require('..controllers/user.controller'); //ruta relativa a api/routes

// define el endpoint: POST /sync
// la ruta completa será: /api/users/sync
router.post('/sync', authenticateUser, syncUserToPostgres);

module.exports = router;