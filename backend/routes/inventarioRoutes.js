// routes/inventarioRoutes.js
const express = require('express');
const {
  getResumen,
  getLotes,
  getLoteDetalle,
  addLote,
  updateLote,
  desactivarLote,
  ajustarStock,
} = require('../controllers/inventarioController');
const {
  listarCompras,
  obtenerCompra,
  crearCompra,
  exportarCompras,
} = require('../controllers/comprasController');

const router = express.Router();

router.get('/resumen', getResumen);
router.get('/lotes', getLotes);
router.get('/lotes/:id', getLoteDetalle);
router.post('/lotes', addLote);
router.put('/lotes/:id', updateLote);
router.patch('/lotes/:id/desactivar', desactivarLote);
router.post('/ajustar', ajustarStock);

router.get('/compras', listarCompras);
router.get('/compras/export', exportarCompras);
router.get('/compras/:id', obtenerCompra);
router.post('/compras', crearCompra);

module.exports = router;

