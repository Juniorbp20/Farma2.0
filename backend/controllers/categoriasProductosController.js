// controllers/categoriasProductosController.js
const sql = require('mssql');
const poolPromise = require('../db');

async function getCategoriasProductos(req, res) {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT CategoriaID, NombreCategoria, Descripcion, Activo
      FROM CategoriasProductos
      WHERE Activo = 1
      ORDER BY NombreCategoria
    `);
    res.json(q.recordset);
  } catch (err) {
    console.error('getCategoriasProductos error:', err);
    res.status(500).json({ message: 'Error al obtener categorías de productos' });
  }
}

module.exports = { getCategoriasProductos };

