// controllers/clientesController.js
const sql = require("mssql");
const poolPromise = require("../db");

// Obtener todos los clientes
const getClientes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT c.ClienteID, c.Nombres, c.Apellidos, c.Documento, c.Telefono, c.Direccion,
             c.Activo, c.FechaCreacion, c.FechaModificacion,
             td.TipoDocumentoID, td.Nombre AS TipoDocumento
      FROM Clientes c
      INNER JOIN TiposDocumentos td ON c.TipoDocumentoID = td.TipoDocumentoID
      WHERE c.Activo = 1
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error obteniendo clientes:", err);
    res.status(500).send("Error en la base de datos");
  }
};

// Obtener cliente por ID
const getClienteById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClienteID", sql.Int, id)
      .query(
        "SELECT * FROM Clientes WHERE ClienteID = @ClienteID"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener el cliente" });
  }
};

// Crear un cliente
const createCliente = async (req, res) => {
  const { Nombres, Apellidos, TipoDocumentoID, Documento, Telefono, Direccion } = req.body;

  if (!Nombres || !Apellidos || !TipoDocumentoID || !Documento) {
    return res.status(400).json({ message: "Faltan datos obligatorios" });
  }

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Nombres", sql.NVarChar(50), Nombres)
      .input("Apellidos", sql.NVarChar(50), Apellidos)
      .input("TipoDocumentoID", sql.Int, TipoDocumentoID)
      .input("Documento", sql.NVarChar(20), Documento)
      .input("Telefono", sql.NVarChar(20), Telefono || null)
      .input("Direccion", sql.NVarChar(200), Direccion || null)
      .query(`
        INSERT INTO Clientes (Nombres, Apellidos, TipoDocumentoID, Documento, Telefono, Direccion)
        VALUES (@Nombres, @Apellidos, @TipoDocumentoID, @Documento, @Telefono, @Direccion)
      `);

    res.status(201).json({ message: "Cliente creado con éxito." });
  } catch (err) {
    if (err.number === 2627) {
      // Clave única duplicada
      return res
        .status(400)
        .json({ message: "Ya existe un cliente con ese documento" });
    }
    console.error("Error creando cliente:", err);
    res.status(500).json({ message: "Error en la base de datos" });
  }
};

// Actualizar cliente
const updateCliente = async (req, res) => {
  const { id } = req.params;
  const { Nombres, Apellidos, Documento, TipoDocumentoID, Telefono, Direccion } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClienteID", sql.Int, id)
      .input("Nombres", sql.NVarChar(50), Nombres)
      .input("Apellidos", sql.NVarChar(50), Apellidos)
      .input("Documento", sql.NVarChar(20), Documento)
      .input("TipoDocumentoID", sql.Int, TipoDocumentoID)
      .input("Telefono", sql.NVarChar(20), Telefono || null)
      .input("Direccion", sql.NVarChar(200), Direccion || null)
      .query(`
        UPDATE Clientes
        SET Nombres=@Nombres, Apellidos=@Apellidos, Documento=@Documento,
            TipoDocumentoID=@TipoDocumentoID, Telefono=@Telefono, Direccion=@Direccion, FechaModificacion=GETDATE()
        WHERE ClienteID=@ClienteID
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente actualizado correctamente." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar el cliente" });
  }
};

// Eliminar cliente (soft delete)
const deleteCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClienteID", sql.Int, id)
      .query("UPDATE Clientes SET Activo = 0 WHERE ClienteID = @ClienteID");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente desactivado correctamente." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al desactivar el cliente" });
  }
};

module.exports = {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
};

