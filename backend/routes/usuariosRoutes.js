// routes/usuariosRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usuariosController');

// Listado y detalle
router.get('/', ctrl.getUsuarios);
router.get('/:id', ctrl.getUsuarioById);

// ABM
router.post('/', ctrl.createUsuario);
router.put('/:id', ctrl.updateUsuario);
router.delete('/:id', ctrl.deleteUsuario);

module.exports = router;

