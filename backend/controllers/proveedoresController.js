// controllers/proveedoresController.js
const sql = require('mssql');
const poolPromise = require('../db');

const selectBase = `
  SELECT ProveedorID, NombreProveedor, Contacto, Email, Telefono, Activo, FechaCreacion
  FROM dbo.Proveedores
`;

async function getProveedores(req, res) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(selectBase + ' ORDER BY ProveedorID');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error listando proveedores:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function getProveedorById(req, res) {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ProveedorID', sql.Int, id)
      .query(selectBase + ' WHERE ProveedorID = @ProveedorID');
    if (!result.recordset.length) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error obteniendo proveedor:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function createProveedor(req, res) {
  const { NombreProveedor, Contacto, Email, Telefono, Activo = true } = req.body || {};
  if (!NombreProveedor || !NombreProveedor.trim()) {
    return res.status(400).json({ message: 'El nombre del proveedor es obligatorio' });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input('NombreProveedor', sql.NVarChar(150), NombreProveedor)
      .input('Contacto', sql.NVarChar(100), Contacto || null)
      .input('Email', sql.NVarChar(100), Email || null)
      .input('Telefono', sql.NVarChar(20), Telefono || null)
      .input('Activo', sql.Bit, Activo ? 1 : 0)
      .query(`
        INSERT INTO dbo.Proveedores (NombreProveedor, Contacto, Email, Telefono, Activo, FechaCreacion)
        VALUES (@NombreProveedor, @Contacto, @Email, @Telefono, @Activo, GETDATE())
      `);
    res.status(201).json({ message: 'Proveedor creado con éxito' });
  } catch (err) {
    console.error('Error creando proveedor:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function updateProveedor(req, res) {
  const { id } = req.params;
  const { NombreProveedor, Contacto, Email, Telefono, Activo } = req.body || {};
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ProveedorID', sql.Int, id)
      .input('NombreProveedor', sql.NVarChar(150), NombreProveedor || null)
      .input('Contacto', sql.NVarChar(100), Contacto || null)
      .input('Email', sql.NVarChar(100), Email || null)
      .input('Telefono', sql.NVarChar(20), Telefono || null)
      .input('Activo', sql.Bit, typeof Activo === 'boolean' ? (Activo ? 1 : 0) : null)
      .query(`
        UPDATE dbo.Proveedores SET
          NombreProveedor = COALESCE(@NombreProveedor, NombreProveedor),
          Contacto = COALESCE(@Contacto, Contacto),
          Email = COALESCE(@Email, Email),
          Telefono = COALESCE(@Telefono, Telefono),
          Activo = COALESCE(@Activo, Activo)
        WHERE ProveedorID = @ProveedorID;
        SELECT @@ROWCOUNT AS affected;
      `);
    if (!result.recordset[0].affected) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json({ message: 'Proveedor actualizado' });
  } catch (err) {
    console.error('Error actualizando proveedor:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function deleteProveedor(req, res) {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ProveedorID', sql.Int, id)
      .query('UPDATE dbo.Proveedores SET Activo = 0 WHERE ProveedorID = @ProveedorID; SELECT @@ROWCOUNT AS affected;');
    if (!result.recordset[0].affected) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json({ message: 'Proveedor desactivado' });
  } catch (err) {
    console.error('Error desactivando proveedor:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

module.exports = { getProveedores, getProveedorById, createProveedor, updateProveedor, deleteProveedor };
