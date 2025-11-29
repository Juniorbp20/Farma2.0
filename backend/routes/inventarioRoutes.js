// routes/inventarioRoutes.js
const express = require('express');
const {
  getResumen,
  getLotes,
  getLoteDetalle,
  addLote,
  updateLote,
  desactivarLote,
  reactivarLote,
  ajustarStock,
  getMarcasActivas,
  getMovimientosRecientes,
} = require('../controllers/inventarioController');
const {
  listarCompras,
  obtenerCompra,
  crearCompra,
  exportarCompras,
} = require('../controllers/comprasController');
const { authorizePermissions } = require('../middleware/authz');

const router = express.Router();

router.get('/resumen', authorizePermissions('inventario:read'), getResumen);
router.get('/lotes', authorizePermissions('inventario:read'), getLotes);
router.get('/lotes/:id', authorizePermissions('inventario:read'), getLoteDetalle);
router.post('/lotes', authorizePermissions('inventario:manage'), addLote);
router.put('/lotes/:id', authorizePermissions('inventario:manage'), updateLote);
router.patch('/lotes/:id/desactivar', authorizePermissions('inventario:manage'), desactivarLote);
router.patch('/lotes/:id/reactivar', authorizePermissions('inventario:manage'), reactivarLote);
router.post('/ajustar', authorizePermissions('inventario:manage'), ajustarStock);
router.get('/marcas', authorizePermissions('inventario:read'), getMarcasActivas);
router.get('/movimientos-recientes', authorizePermissions('inventario:read'), getMovimientosRecientes);

router.get('/compras', authorizePermissions('inventario:read'), listarCompras);
router.get('/compras/export', authorizePermissions('inventario:read'), exportarCompras);
router.get('/compras/:id', authorizePermissions('inventario:read'), obtenerCompra);
router.post('/compras', authorizePermissions('inventario:manage'), crearCompra);

module.exports = router;

