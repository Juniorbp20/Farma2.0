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
        res.status(500).json({ 
            message: "Error en la base de datos",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = { getTiposDocumentos };
