// controllers/unidadesMedidaController.js
const sql = require('mssql');
const poolPromise = require('../db');

// GET /unidadesmedida?tipo=empaque|minima
// empaque -> TipoUnidad IN ('Empaque','Ambas')
// minima  -> TipoUnidad IN ('Medida','Empaque','Ambas')
async function getUnidadesMedida(req, res) {
  const tipo = String((req.query.tipo || '').toLowerCase());
  let whereTipo = '';
  if (tipo === 'empaque') {
    // Empaque: 'Empaque' y 'Ambas'
    whereTipo = "AND (LOWER(LTRIM(RTRIM(TipoUnidad))) IN ('empaque','ambas'))";
  } else if (tipo === 'minima') {
    // Mínima: 'Medida' y 'Ambas'
    whereTipo = "AND (LOWER(LTRIM(RTRIM(TipoUnidad))) IN ('medida','ambas'))";
  }
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT UnidadMedidaID, Nombre, Descripcion, TipoUnidad
      FROM UnidadesMedida
      WHERE Activo = 1 ${whereTipo}
      ORDER BY Nombre
    `);
    res.json(q.recordset);
  } catch (err) {
    console.error('getUnidadesMedida error:', err);
    res.status(500).json({ message: 'Error al obtener unidades de medida' });
  }
}

module.exports = { getUnidadesMedida };
