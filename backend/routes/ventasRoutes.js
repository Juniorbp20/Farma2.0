// routes/ventasRoutes.js
const express = require('express');
const { crearVenta, listarVentas, anularVenta, obtenerPdf } = require('../controllers/ventasController');

const router = express.Router();

router.get('/', listarVentas);
router.get('/:ventaId/pdf', obtenerPdf);
router.post('/:ventaId/anular', anularVenta);
router.post('/', crearVenta);

module.exports = router;

