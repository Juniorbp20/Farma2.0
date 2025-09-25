// routes/ventasRoutes.js
const express = require('express');
const { crearVenta } = require('../controllers/ventasController');

const router = express.Router();

router.post('/', crearVenta);

module.exports = router;

