// controllers/rolesController.js
const sql = require('mssql');
const poolPromise = require('../db');

async function getRoles(req, res) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT RolID, NombreRol, Descripcion, Activo
      FROM dbo.Roles
      WHERE Activo = 1
      ORDER BY RolID
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error obteniendo roles:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

module.exports = { getRoles };

