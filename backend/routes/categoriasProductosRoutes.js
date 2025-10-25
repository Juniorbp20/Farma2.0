// routes/categoriasProductosRoutes.js
const express = require('express');
const { getCategoriasProductos } = require('../controllers/categoriasProductosController');

const router = express.Router();

router.get('/', getCategoriasProductos);

module.exports = router;

