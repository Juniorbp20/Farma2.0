// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const poolPromise = require('../db');

function normalizeRole({ rolNombre, rolId }) {
  let name = (rolNombre || '').toString().toLowerCase();
  if (!name && (rolId === 1 || rolId === '1')) name = 'admin';
  if (name.startsWith('admin') || name === 'administrador' || name === 'administradora') name = 'admin';
  return name || (rolId != null ? String(rolId) : 'user');
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
  }
  try {
    const pool = await poolPromise;
    const baseRequest = pool.request().input('Username', sql.NVarChar(50), username);
    const queryWithRole = `
      SELECT TOP 1 
        u.UsuarioID, u.Username, u.PasswordUser, u.RolID, u.Activo, u.Nombres, u.Apellidos,
        r.NombreRol AS RolNombre
      FROM dbo.Usuarios u
      LEFT JOIN dbo.Roles r ON r.RolID = u.RolID
      WHERE LOWER(LTRIM(RTRIM(u.Username))) = LOWER(LTRIM(RTRIM(@Username)))
    `;
    let result;
    try {
      result = await baseRequest.query(queryWithRole);
    } catch (e) {
      // Si la tabla Roles no existe, hacer consulta sin join
      if ((e && e.message || '').includes('Invalid object name') && (e.message || '').includes('Roles')) {
        result = await baseRequest.query(`
          SELECT TOP 1 u.UsuarioID, u.Username, u.PasswordUser, u.RolID, u.Activo, u.Nombres, u.Apellidos
          FROM dbo.Usuarios u
          WHERE LOWER(LTRIM(RTRIM(u.Username))) = LOWER(LTRIM(RTRIM(@Username)))
        `);
      } else {
        throw e;
      }
    }

    if (!result.recordset.length) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    const user = result.recordset[0];
    if (!user.Activo) return res.status(403).json({ message: 'Usuario inactivo' });

    // La lógica de comparación de contraseñas es necesaria aquí
    const ok = await bcrypt.compare(password, user.PasswordUser || '');
    if (!ok) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

    const rol = normalizeRole({ rolNombre: user.RolNombre, rolId: user.RolID });
    const payload = { sub: user.UsuarioID, username: user.Username, rol, rolId: user.RolID };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // Logs mínimos en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('login ok:', { username: user.Username, rol, rolId: user.RolID });
    }

    res.json({ token, user: { id: user.UsuarioID, username: user.Username, nombres: user.Nombres, apellidos: user.Apellidos, rol, rolId: user.RolID } });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
}

module.exports = { login };