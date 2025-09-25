// routes/rolesRoutes.js
const express = require('express');
const router = express.Router();
const { getRoles } = require('../controllers/rolesController');

router.get('/', getRoles);

module.exports = router;

