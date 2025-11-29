// routes/ventasRoutes.js
const express = require('express');
const { crearVenta, listarVentas, obtenerVenta, devolucionVenta, anularVenta, obtenerPdf, historialDia } = require('../controllers/ventasController');
const { authorizePermissions } = require('../middleware/authz');

const router = express.Router();

router.get('/historial-dia', authorizePermissions('ventas:read'), historialDia);
router.get('/', authorizePermissions('ventas:read'), listarVentas);
router.get('/:ventaId/pdf', authorizePermissions('ventas:read'), obtenerPdf);
router.get('/:ventaId', authorizePermissions('ventas:read'), obtenerVenta);
router.post('/:ventaId/devolucion', authorizePermissions('ventas:devolucion'), devolucionVenta);
router.post('/:ventaId/anular', authorizePermissions('ventas:anular'), anularVenta);
router.post('/', authorizePermissions('ventas:create'), crearVenta);

module.exports = router;
