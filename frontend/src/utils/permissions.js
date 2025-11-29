// src/utils/permissions.js
// Utilidad centralizada de permisos para alinear frontend con backend.

const ROLE_PERMISSIONS = {
  admin: new Set([
    'clientes:read', 'clientes:create', 'clientes:update', 'clientes:delete',
    'usuarios:manage',
    'productos:read', 'productos:create', 'productos:update', 'productos:delete',
    'proveedores:read', 'proveedores:create', 'proveedores:update', 'proveedores:delete',
    'reportes:read',
    'inventario:read', 'inventario:manage',
    'ventas:read', 'ventas:create', 'ventas:anular', 'ventas:devolucion',
  ]),
  cajero: new Set([
    'clientes:read', 'clientes:create', 'clientes:update',
    'productos:read',
    'ventas:read', 'ventas:create', 'ventas:anular', 'ventas:devolucion',
    'inventario:read',
  ]),
  farmaceutico: new Set([
    'clientes:read',
    'productos:read',
    'proveedores:read',
    'inventario:read',
  ]),
  inventario: new Set([
    'productos:read', 'productos:create', 'productos:update', 'productos:delete',
    'proveedores:read', 'proveedores:create', 'proveedores:update', 'proveedores:delete',
    'inventario:read', 'inventario:manage',
  ]),
};

function normalizeRoleKey(roleOrId) {
  const raw = (roleOrId ?? '').toString().toLowerCase();
  if (raw === '1' || raw.startsWith('admin')) return 'admin';
  if (raw === '2' || raw.startsWith('cajero')) return 'cajero';
  if (raw === '3' || raw.startsWith('farm')) return 'farmaceutico';
  if (raw === '4' || raw.startsWith('invent')) return 'inventario';
  return raw || 'user';
}

export function buildPermissions(user) {
  const roleId = Number(user?.rolId ?? user?.rolID ?? user?.RolID ?? user?.rol ?? 0) || 0;
  const roleKey = normalizeRoleKey(user?.rol ?? roleId);
  const perms = ROLE_PERMISSIONS[roleKey] || new Set();

  const can = (perm) => perms.has(perm);
  const hasAll = (list = []) => list.every((p) => perms.has(p));
  const hasAny = (list = []) => list.some((p) => perms.has(p));

  return { roleId, roleKey, can, hasAll, hasAny, perms };
}
