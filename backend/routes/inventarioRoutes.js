// routes/inventarioRoutes.js
const express = require('express');
const { getLotes, addLote, ajustarStock, getResumen } = require('../controllers/inventarioController');

const router = express.Router();

router.get('/lotes', getLotes);
router.post('/lotes', addLote);
router.post('/ajustar', ajustarStock);
router.get('/resumen', getResumen);

module.exports = router;

