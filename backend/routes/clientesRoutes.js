// routes/clientesRoutes.js
const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");
const { authorizePermissions } = require("../middleware/authz");

// Listar y obtener detalle (cualquier usuario autenticado)
router.get("/", clientesController.getClientes);
router.get("/:id", clientesController.getClienteById);

// Permisos granulares por acción
router.post("/", authorizePermissions('clientes:create'), clientesController.createCliente);
router.put("/:id", authorizePermissions('clientes:update'), clientesController.updateCliente);
router.delete("/:id", authorizePermissions('clientes:delete'), clientesController.deleteCliente);

module.exports = router;
