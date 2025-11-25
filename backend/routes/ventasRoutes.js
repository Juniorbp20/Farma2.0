// routes/ventasRoutes.js
const express = require('express');
const { crearVenta, listarVentas, obtenerVenta, devolucionVenta, anularVenta, obtenerPdf } = require('../controllers/ventasController');

const router = express.Router();

router.get('/', listarVentas);
router.get('/:ventaId/pdf', obtenerPdf);
router.get('/:ventaId', obtenerVenta);
router.post('/:ventaId/devolucion', devolucionVenta);
router.post('/:ventaId/anular', anularVenta);
router.post('/', crearVenta);

module.exports = router;
