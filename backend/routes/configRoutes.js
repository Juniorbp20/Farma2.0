// routes/configRoutes.js
const express = require('express');
const { obtenerParametros, actualizarParametros } = require('../controllers/configController');
const { requireAdmin } = require('../middleware/authz');

const router = express.Router();

router.get('/parametros-sistema', obtenerParametros);
router.put('/parametros-sistema', requireAdmin, actualizarParametros);

module.exports = router;

