// routes/productosRoutes.js
const express = require('express');
const { getProductos, buscarProductos, getProductoByBarcode, createProducto, updateProducto, deleteProducto } = require('../controllers/productosController');
const { authorizePermissions } = require('../middleware/authz');

const router = express.Router();

router.get('/', authorizePermissions('productos:read'), getProductos);
router.get('/buscar', authorizePermissions('productos:read'), buscarProductos);
router.get('/barcode/:codigo', authorizePermissions('productos:read'), getProductoByBarcode);
router.post('/', authorizePermissions('productos:create'), createProducto);
router.put('/:id', authorizePermissions('productos:update'), updateProducto);
router.delete('/:id', authorizePermissions('productos:delete'), deleteProducto);

module.exports = router;
