// routes/unidadesMedidaRoutes.js
const express = require('express');
const { getUnidadesMedida } = require('../controllers/unidadesMedidaController');
const { authorizePermissions } = require('../middleware/authz');

const router = express.Router();

router.get('/', authorizePermissions('productos:read'), getUnidadesMedida);

module.exports = router;

