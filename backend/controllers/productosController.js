// controllers/productosController.js
// Implementación contra SQL Server (tabla Productos)
const sql = require('mssql');
const poolPromise = require('../db');

function mapProductoRow(r) {
  return {
    ProductoID: r.ProductoID,
    Nombre: r.NombreProducto,
    Presentacion: r.Presentacion,
    CategoriaID: r.CategoriaID,
    Stock: Number(r.StockActual || 0),
    StockMinimo: Number(r.StockMinimo || 0),
    // Nombres desde JOIN de UnidadesMedida
    UnidadMedidaEmpaque: r.UnidadMedidaEmpaqueNombre || '',
    UnidadMedidaMinima: r.UnidadMedidaMinimaNombre || '',
    // IDs para formularios
    UnidadMedidaEmpaqueID: r.UnidadMedidaEmpaqueID || null,
    UnidadMedidaMinimaID: r.UnidadMedidaMinimaID || null,
    CantidadUnidadMinimaXEmpaque: Number(r.CantidadUnidadMinimaXEmpaque || 0),
    Activo: r.Activo,
  };
}

const getProductos = async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.CantidadUnidadMinimaXEmpaque,
             ume.Nombre AS UnidadMedidaEmpaqueNombre,
             umm.Nombre AS UnidadMedidaMinimaNombre
      FROM Productos p
      LEFT JOIN UnidadesMedida ume ON ume.UnidadMedidaID = p.UnidadMedidaEmpaqueID
      LEFT JOIN UnidadesMedida umm ON umm.UnidadMedidaID = p.UnidadMedidaMinimaID
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
        SELECT TOP 25 p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
               p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.CantidadUnidadMinimaXEmpaque,
               ume.Nombre AS UnidadMedidaEmpaqueNombre,
               umm.Nombre AS UnidadMedidaMinimaNombre
        FROM Productos p
        LEFT JOIN UnidadesMedida ume ON ume.UnidadMedidaID = p.UnidadMedidaEmpaqueID
        LEFT JOIN UnidadesMedida umm ON umm.UnidadMedidaID = p.UnidadMedidaMinimaID
        WHERE p.Activo = 1 AND (
          p.NombreProducto LIKE @term OR p.Presentacion LIKE @term OR
          ume.Nombre LIKE @term OR umm.Nombre LIKE @term
        )
        ORDER BY p.NombreProducto
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
    let { Nombre, Presentacion, StockMinimo, CategoriaID, UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, CantidadUnidadMinimaXEmpaque, Activo, UnidadMedidaEmpaque, UnidadMedidaMinima } = req.body || {};
    if (!Nombre) return res.status(400).json({ message: 'Falta Nombre' });
    // Permitir compatibilidad: si no vienen IDs pero sí nombres, resolver IDs por nombre
    const pool = await poolPromise;
    if (UnidadMedidaEmpaqueID == null && UnidadMedidaEmpaque) {
      try {
        const r = await pool.request().input('n', sql.NVarChar(50), UnidadMedidaEmpaque).query("SELECT TOP 1 UnidadMedidaID FROM UnidadesMedida WHERE Activo = 1 AND LOWER(LTRIM(RTRIM(Nombre))) = LOWER(LTRIM(RTRIM(@n)))");
        if (r.recordset.length) UnidadMedidaEmpaqueID = r.recordset[0].UnidadMedidaID;
      } catch {}
    }
    if (UnidadMedidaMinimaID == null && UnidadMedidaMinima) {
      try {
        const r2 = await pool.request().input('n', sql.NVarChar(50), UnidadMedidaMinima).query("SELECT TOP 1 UnidadMedidaID FROM UnidadesMedida WHERE Activo = 1 AND LOWER(LTRIM(RTRIM(Nombre))) = LOWER(LTRIM(RTRIM(@n)))");
        if (r2.recordset.length) UnidadMedidaMinimaID = r2.recordset[0].UnidadMedidaID;
      } catch {}
    }
    if (UnidadMedidaEmpaqueID == null) return res.status(400).json({ message: 'Falta UnidadMedidaEmpaqueID' });
    if (UnidadMedidaMinimaID == null) return res.status(400).json({ message: 'Falta UnidadMedidaMinimaID' });
    if (CantidadUnidadMinimaXEmpaque == null) return res.status(400).json({ message: 'Falta CantidadUnidadMinimaXEmpaque' });
    const stockMin = Number(StockMinimo || 0);
    const cantMin = Number(CantidadUnidadMinimaXEmpaque || 0);
    if (!Number.isFinite(stockMin) || stockMin < 1) return res.status(400).json({ message: 'StockMinimo debe ser al menos 1' });
    if (!Number.isFinite(cantMin) || cantMin < 1) return res.status(400).json({ message: 'CantidadUnidadMinimaXEmpaque debe ser al menos 1' });
    // pool ya disponible como conexión
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
      .input('StockMinimo', sql.Int, stockMin)
      .input('CategoriaID', sql.Int, categoria)
      .input('Activo', sql.Bit, Activo != null ? (Activo ? 1 : 0) : 1)
      .input('UnidadMedidaEmpaqueID', sql.Int, Number(UnidadMedidaEmpaqueID))
      .input('UnidadMedidaMinimaID', sql.Int, Number(UnidadMedidaMinimaID))
      .input('CantidadUnidadMinimaXEmpaque', sql.Int, cantMin)
      .query(`
        INSERT INTO Productos (NombreProducto, Presentacion, StockActual, StockMinimo, CategoriaID, Activo, FechaCreacion,
                               UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, CantidadUnidadMinimaXEmpaque)
        VALUES (@NombreProducto, @Presentacion, 0, @StockMinimo, @CategoriaID, @Activo, GETDATE(),
                @UnidadMedidaEmpaqueID, @UnidadMedidaMinimaID, @CantidadUnidadMinimaXEmpaque);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    const id = Number(r.recordset[0].id);
    const sel = await pool.request().input('id', sql.Int, id).query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.CantidadUnidadMinimaXEmpaque,
             ume.Nombre AS UnidadMedidaEmpaqueNombre,
             umm.Nombre AS UnidadMedidaMinimaNombre
      FROM Productos p
      LEFT JOIN UnidadesMedida ume ON ume.UnidadMedidaID = p.UnidadMedidaEmpaqueID
      LEFT JOIN UnidadesMedida umm ON umm.UnidadMedidaID = p.UnidadMedidaMinimaID
      WHERE p.ProductoID = @id
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
    let { Nombre, Presentacion, StockMinimo, CategoriaID, Activo, UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, CantidadUnidadMinimaXEmpaque, UnidadMedidaEmpaque, UnidadMedidaMinima } = req.body || {};
    if (StockMinimo != null && Number(StockMinimo) < 1) return res.status(400).json({ message: 'StockMinimo debe ser al menos 1' });
    if (CantidadUnidadMinimaXEmpaque != null && Number(CantidadUnidadMinimaXEmpaque) < 1) return res.status(400).json({ message: 'CantidadUnidadMinimaXEmpaque debe ser al menos 1' });
    const pool = await poolPromise;
    // Compat: si vienen nombres y no IDs, resolver por nombre
    if (UnidadMedidaEmpaqueID == null && UnidadMedidaEmpaque) {
      try {
        const r = await pool.request().input('n', sql.NVarChar(50), UnidadMedidaEmpaque).query("SELECT TOP 1 UnidadMedidaID FROM UnidadesMedida WHERE Activo = 1 AND LOWER(LTRIM(RTRIM(Nombre))) = LOWER(LTRIM(RTRIM(@n)))");
        if (r.recordset.length) UnidadMedidaEmpaqueID = r.recordset[0].UnidadMedidaID;
      } catch {}
    }
    if (UnidadMedidaMinimaID == null && UnidadMedidaMinima) {
      try {
        const r2 = await pool.request().input('n', sql.NVarChar(50), UnidadMedidaMinima).query("SELECT TOP 1 UnidadMedidaID FROM UnidadesMedida WHERE Activo = 1 AND LOWER(LTRIM(RTRIM(Nombre))) = LOWER(LTRIM(RTRIM(@n)))");
        if (r2.recordset.length) UnidadMedidaMinimaID = r2.recordset[0].UnidadMedidaID;
      } catch {}
    }

    const r = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .input('NombreProducto', sql.NVarChar(200), Nombre || null)
      .input('Presentacion', sql.NVarChar(200), Presentacion || null)
      .input('StockMinimo', sql.Int, StockMinimo != null ? Number(StockMinimo) : null)
      .input('CategoriaID', sql.Int, CategoriaID != null ? Number(CategoriaID) : null)
      .input('Activo', sql.Bit, Activo != null ? (Activo ? 1 : 0) : null)
      .input('UnidadMedidaEmpaqueID', sql.Int, UnidadMedidaEmpaqueID != null ? Number(UnidadMedidaEmpaqueID) : null)
      .input('UnidadMedidaMinimaID', sql.Int, UnidadMedidaMinimaID != null ? Number(UnidadMedidaMinimaID) : null)
      .input('CantidadUnidadMinimaXEmpaque', sql.Int, CantidadUnidadMinimaXEmpaque != null ? Number(CantidadUnidadMinimaXEmpaque) : null)
      .query(`
        UPDATE Productos SET
          NombreProducto = COALESCE(@NombreProducto, NombreProducto),
          Presentacion   = COALESCE(@Presentacion, Presentacion),
          StockMinimo    = COALESCE(@StockMinimo, StockMinimo),
          CategoriaID    = COALESCE(@CategoriaID, CategoriaID),
          UnidadMedidaEmpaqueID = COALESCE(@UnidadMedidaEmpaqueID, UnidadMedidaEmpaqueID),
          UnidadMedidaMinimaID = COALESCE(@UnidadMedidaMinimaID, UnidadMedidaMinimaID),
          CantidadUnidadMinimaXEmpaque = COALESCE(@CantidadUnidadMinimaXEmpaque, CantidadUnidadMinimaXEmpaque),
          Activo         = COALESCE(@Activo, Activo),
          FechaModificacion = GETDATE()
        WHERE ProductoID = @id;
        SELECT @@ROWCOUNT AS affected;
      `);
    if (!r.recordset[0].affected) return res.status(404).json({ message: 'Producto no encontrado' });
    const sel = await pool.request().input('id', sql.Int, Number(id)).query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.CantidadUnidadMinimaXEmpaque,
             ume.Nombre AS UnidadMedidaEmpaqueNombre,
             umm.Nombre AS UnidadMedidaMinimaNombre
      FROM Productos p
      LEFT JOIN UnidadesMedida ume ON ume.UnidadMedidaID = p.UnidadMedidaEmpaqueID
      LEFT JOIN UnidadesMedida umm ON umm.UnidadMedidaID = p.UnidadMedidaMinimaID
      WHERE p.ProductoID = @id
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
    // Si hay lotes con stock > 0, impedir desactivación.
    // Adaptado al esquema: existen columnas CantidadEmpaques y/o CantidadUnidadesMinimas
    const lot = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        IF OBJECT_ID('dbo.Lotes','U') IS NOT NULL
        BEGIN
          SELECT TOP 1 1 AS has
          FROM Lotes
          WHERE ProductoID = @id AND (Activo = 1 OR Activo IS NULL)
            AND (
              ISNULL(CantidadEmpaques,0) > 0 OR ISNULL(CantidadUnidadesMinimas,0) > 0
            )
        END
        ELSE
        BEGIN
          SELECT TOP 0 1 AS has
        END
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
