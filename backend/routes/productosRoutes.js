// routes/productosRoutes.js
const express = require('express');
const { getProductos, buscarProductos, getProductoByBarcode, createProducto, updateProducto, deleteProducto } = require('../controllers/productosController');

const router = express.Router();

router.get('/', getProductos);
router.get('/buscar', buscarProductos);
router.get('/barcode/:codigo', getProductoByBarcode);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

module.exports = router;
