// controllers/productosController.js
// Implementación contra SQL Server (tabla Productos)
const sql = require('mssql');
const poolPromise = require('../db');

function mapProductoRow(r) {
  return {
    ProductoID: r.ProductoID,
    Nombre: r.NombreProducto,
    Presentacion: r.Presentacion,
    Precio: Number(r.PrecioUnitario || 0),
    Stock: Number(r.StockActual || 0),
    StockMinimo: Number(r.StockMinimo || 0),
    CategoriaID: r.CategoriaID,
    Activo: r.Activo,
    CodigoBarra: '',
  };
}

const getProductos = async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT ProductoID, NombreProducto, Presentacion, PrecioUnitario, StockActual, StockMinimo, CategoriaID, Activo
      FROM Productos WHERE Activo = 1
    `);
    res.json(q.recordset.map(mapProductoRow));
  } catch (err) {
    console.error('getProductos error:', err);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

const buscarProductos = async (req, res) => {
  try {
    const term = String((req.query.q || '').trim());
    if (!term) return res.json([]);
    const pool = await poolPromise;
    const q = await pool
      .request()
      .input('term', sql.NVarChar(200), `%${term}%`)
      .query(`
        SELECT TOP 25 ProductoID, NombreProducto, Presentacion, PrecioUnitario, StockActual, StockMinimo, CategoriaID, Activo
        FROM Productos
        WHERE Activo = 1 AND (NombreProducto LIKE @term OR Presentacion LIKE @term)
        ORDER BY NombreProducto
      `);
    res.json(q.recordset.map(mapProductoRow));
  } catch (err) {
    console.error('buscarProductos error:', err);
    res.status(500).json({ message: 'Error al buscar productos' });
  }
};

// No hay columna de código de barras en el esquema proporcionado
const getProductoByBarcode = async (req, res) => {
  return res.status(404).json({ message: 'Búsqueda por código de barras no disponible' });
};

const createProducto = async (req, res) => {
  try {
    const { Nombre, Presentacion, Precio, StockMinimo, CategoriaID } = req.body || {};
    if (!Nombre) return res.status(400).json({ message: 'Falta Nombre' });
    const pool = await poolPromise;
    let categoria = CategoriaID != null ? Number(CategoriaID) : null;
    if (categoria == null) {
      try {
        const cat = await pool.request().query('SELECT TOP 1 CategoriaID FROM CategoriasProductos ORDER BY CategoriaID');
        if (cat.recordset.length) categoria = Number(cat.recordset[0].CategoriaID);
      } catch {}
      if (categoria == null) categoria = 1; // fallback
    }

    const r = await pool
      .request()
      .input('NombreProducto', sql.NVarChar(200), Nombre)
      .input('Presentacion', sql.NVarChar(200), (Presentacion ?? '').toString())
      .input('PrecioUnitario', sql.Decimal(18, 2), Number(Precio || 0))
      .input('StockMinimo', sql.Int, Number(StockMinimo || 0))
      .input('CategoriaID', sql.Int, categoria)
      .query(`
        INSERT INTO Productos (NombreProducto, Presentacion, PrecioUnitario, StockActual, StockMinimo, CategoriaID, Activo, FechaCreacion)
        VALUES (@NombreProducto, @Presentacion, @PrecioUnitario, 0, @StockMinimo, @CategoriaID, 1, GETDATE());
        SELECT SCOPE_IDENTITY() AS id;
      `);
    const id = Number(r.recordset[0].id);
    const sel = await pool.request().input('id', sql.Int, id).query(`
      SELECT ProductoID, NombreProducto, Presentacion, PrecioUnitario, StockActual, StockMinimo, CategoriaID, Activo
      FROM Productos WHERE ProductoID = @id
    `);
    res.status(201).json(mapProductoRow(sel.recordset[0]));
  } catch (err) {
    console.error('createProducto error:', err);
    const payload = { message: 'Error al crear producto' };
    if (process.env.NODE_ENV !== 'production') payload.detail = err?.message;
    res.status(500).json(payload);
  }
};

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { Nombre, Presentacion, Precio, StockMinimo, CategoriaID, Activo } = req.body || {};
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .input('NombreProducto', sql.NVarChar(200), Nombre || null)
      .input('Presentacion', sql.NVarChar(200), Presentacion || null)
      .input('PrecioUnitario', sql.Decimal(18, 2), Precio != null ? Number(Precio) : null)
      .input('StockMinimo', sql.Int, StockMinimo != null ? Number(StockMinimo) : null)
      .input('CategoriaID', sql.Int, CategoriaID != null ? Number(CategoriaID) : null)
      .input('Activo', sql.Bit, Activo != null ? (Activo ? 1 : 0) : null)
      .query(`
        UPDATE Productos SET
          NombreProducto = COALESCE(@NombreProducto, NombreProducto),
          Presentacion   = COALESCE(@Presentacion, Presentacion),
          PrecioUnitario = COALESCE(@PrecioUnitario, PrecioUnitario),
          StockMinimo    = COALESCE(@StockMinimo, StockMinimo),
          CategoriaID    = COALESCE(@CategoriaID, CategoriaID),
          Activo         = COALESCE(@Activo, Activo),
          FechaModificacion = GETDATE()
        WHERE ProductoID = @id;
        SELECT @@ROWCOUNT AS affected;
      `);
    if (!r.recordset[0].affected) return res.status(404).json({ message: 'Producto no encontrado' });
    const sel = await pool.request().input('id', sql.Int, Number(id)).query(`
      SELECT ProductoID, NombreProducto, Presentacion, PrecioUnitario, StockActual, StockMinimo, CategoriaID, Activo
      FROM Productos WHERE ProductoID = @id
    `);
    res.json(mapProductoRow(sel.recordset[0]));
  } catch (err) {
    console.error('updateProducto error:', err);
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
};

const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    // Si hay lotes con cantidad > 0, impedir borrado
    const lot = await pool.request().input('id', sql.Int, Number(id)).query(`
      SELECT TOP 1 1 AS has
      FROM Lotes WHERE ProductoID = @id AND Activo = 1 AND Cantidad > 0
    `);
    if (lot.recordset.length) return res.status(400).json({ message: 'No se puede eliminar: existen lotes con stock' });
    const r = await pool.request().input('id', sql.Int, Number(id)).query(`
      UPDATE Productos SET Activo = 0, FechaModificacion = GETDATE() WHERE ProductoID = @id;
      SELECT @@ROWCOUNT AS affected;
    `);
    if (!r.recordset[0].affected) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json({ message: 'Producto desactivado' });
  } catch (err) {
    console.error('deleteProducto error:', err);
    res.status(500).json({ message: 'Error al desactivar producto' });
  }
};

module.exports = { getProductos, buscarProductos, getProductoByBarcode, createProducto, updateProducto, deleteProducto };
