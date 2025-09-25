// routes/tiposDocumentosRoutes.js
const express = require("express");
const router = express.Router();
const tiposController = require("../controllers/tiposDocumentosController");

router.get("/", tiposController.getTiposDocumentos);

module.exports = router;
