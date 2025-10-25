// middleware/authz.js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autenticado' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalido' });
  }
}

function stripAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function norm(role) {
  const r = (role ?? '').toString().toLowerCase();
  if (r === '1' || r.startsWith('admin') || r === 'administrador' || r === 'administradora') return 'admin';
  return r;
}

function authorizeRoles(...roles) {
  const allowed = roles.map(norm);
  return (req, res, next) => {
    const userRole = norm(req.user?.rol ?? req.user?.rolId);
    if (!userRole || !allowed.includes(userRole)) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    next();
  };
}

const ROLE_PERMISSIONS = {
  admin: new Set([
    'clientes:read','clientes:create','clientes:update','clientes:delete',
    'usuarios:manage',
    'productos:read','productos:create','productos:update','productos:delete',
    'proveedores:read','proveedores:create','proveedores:update','proveedores:delete'
  ]),
  cajero: new Set([
    'clientes:read','clientes:create','clientes:update',
    'productos:read','proveedores:read'
  ]),
  farmaceutico: new Set([
    'clientes:read','productos:read','proveedores:read'
  ]),
  inventario: new Set([
    'clientes:read','productos:read','proveedores:read'
  ])
};

function roleKey(nameOrId) {
  const s = String(nameOrId ?? '').toLowerCase();
  if (s === '1') return 'admin';
  const clean = stripAccents(s);
  if (clean.startsWith('admin')) return 'admin';
  if (clean.startsWith('cajero')) return 'cajero';
  if (clean.startsWith('farmaceut')) return 'farmaceutico';
  if (clean.startsWith('invent')) return 'inventario';
  return clean || 'user';
}

function authorizePermissions(...perms) {
  return (req, res, next) => {
    const key = roleKey(req.user?.rol ?? req.user?.rolId);
    const allowed = ROLE_PERMISSIONS[key] || new Set();
    const ok = perms.every(p => allowed.has(p));
    if (!ok) return res.status(403).json({ message: 'No autorizado' });
    next();
  };
}

module.exports = { authenticate, authorizeRoles, authorizePermissions, ROLE_PERMISSIONS };

