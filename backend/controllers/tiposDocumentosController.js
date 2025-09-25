// controllers/tiposDocumentosController.js
const sql = require("mssql");
const poolPromise = require("../db");

// Obtener todos los tipos de documentos activos
const getTiposDocumentos = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT TipoDocumentoID, Nombre, Descripcion
      FROM TiposDocumentos
      WHERE Activo = 1
    `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error obteniendo tipos de documentos:", err);
        res.status(500).send("Error en la base de datos");
    }
};

module.exports = { getTiposDocumentos };
