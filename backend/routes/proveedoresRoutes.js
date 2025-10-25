// routes/proveedoresRoutes.js
const express = require('express');
const ctrl = require('../controllers/proveedoresController');
const { authorizePermissions } = require('../middleware/authz');

const router = express.Router();

router.get('/', authorizePermissions('proveedores:read'), ctrl.getProveedores);
router.get('/:id', authorizePermissions('proveedores:read'), ctrl.getProveedorById);
router.post('/', authorizePermissions('proveedores:create'), ctrl.createProveedor);
router.put('/:id', authorizePermissions('proveedores:update'), ctrl.updateProveedor);
router.delete('/:id', authorizePermissions('proveedores:delete'), ctrl.deleteProveedor);

module.exports = router;

