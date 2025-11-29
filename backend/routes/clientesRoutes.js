// routes/clientesRoutes.js
const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");
const { authorizePermissions } = require("../middleware/authz");

router.get("/", authorizePermissions('clientes:read'), clientesController.getClientes);
router.get("/:id", authorizePermissions('clientes:read'), clientesController.getClienteById);

router.post("/", authorizePermissions('clientes:create'), clientesController.createCliente);
router.put("/:id", authorizePermissions('clientes:update'), clientesController.updateCliente);
router.delete("/:id", authorizePermissions('clientes:delete'), clientesController.deleteCliente);

module.exports = router;
