// controllers/productosController.js
const sql = require('mssql');
const poolPromise = require('../db');
const { getLotesColumnInfo, getCantidadExpressions, ensurePositiveNumber } = require('../store/inventoryUtils');

function mapProductoRow(r) {
  return {
    ProductoID: r.ProductoID,
    Nombre: r.NombreProducto,
    Presentacion: r.Presentacion,
    CategoriaID: r.CategoriaID,
    Stock: Number(r.StockActual || 0),
    StockMinimo: Number(r.StockMinimo || 0),
    Impuesto: Number(r.Impuesto ?? 0),
    UnidadMedidaEmpaque: r.UnidadMedidaEmpaqueNombre || '',
    UnidadMedidaMinima: r.UnidadMedidaMinimaNombre || '',
    UnidadMedidaEmpaqueID: r.UnidadMedidaEmpaqueID || null,
    UnidadMedidaMinimaID: r.UnidadMedidaMinimaID || null,
    Activo: r.Activo,
  };
}

const getProductos = async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.Impuesto,
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
    const raw = (req.query.q ?? req.query.search ?? '').toString();
    const term = raw.trim();
    if (!term) return res.json([]);
    const soloConStock = String(req.query.soloConStock || req.query.solo_stock || '').toLowerCase() === 'true';
    const pool = await poolPromise;
    const request = pool
      .request()
      .input('term', sql.NVarChar(200), `%${term}%`);
    let query = `
      SELECT TOP 25 p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.Impuesto,
             ume.Nombre AS UnidadMedidaEmpaqueNombre,
             umm.Nombre AS UnidadMedidaMinimaNombre
      FROM dbo.Productos p
      LEFT JOIN dbo.UnidadesMedida ume ON ume.UnidadMedidaID = p.UnidadMedidaEmpaqueID
      LEFT JOIN dbo.UnidadesMedida umm ON umm.UnidadMedidaID = p.UnidadMedidaMinimaID
      WHERE p.Activo = 1 AND (
        p.NombreProducto LIKE @term OR p.Presentacion LIKE @term OR
        ume.Nombre LIKE @term OR umm.Nombre LIKE @term
      )
    `;
    if (soloConStock) {
      const meta = await getLotesColumnInfo();
      const { cantidadExpr } = getCantidadExpressions(meta, { alias: 'l', productAlias: 'p' });
      query += ` AND (
        EXISTS (
          SELECT 1 FROM dbo.Lotes l
          WHERE l.ProductoID = p.ProductoID AND COALESCE(l.Activo,1) = 1
            AND (l.FechaVencimiento IS NULL OR DATEDIFF(day, CAST(GETDATE() AS date), l.FechaVencimiento) >= 0)
            AND (${cantidadExpr} > 0)
        )
        OR COALESCE(p.StockActual,0) > 0
      )`;
    }
    query += ` ORDER BY p.NombreProducto`;
    const q = await request.query(query);
    res.json(q.recordset.map(mapProductoRow));
  } catch (err) {
    console.error('buscarProductos error:', err);
    res.status(500).json({ message: 'Error al buscar productos' });
  }
};

const getProductoByBarcode = async (req, res) => {
  return res.status(404).json({ message: 'Busqueda por codigo de barras no disponible' });
};

const consultarProductoInventario = async (req, res) => {
  try {
    const term = (req.query.busqueda || '').toString().trim();
    if (!term) return res.status(400).json({ message: 'Parametro busqueda requerido' });

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();
    const { totalExpr } = getCantidadExpressions(meta, { alias: 'l' });

    const qProd = await pool
      .request()
      .input('term', sql.NVarChar(200), `%${term}%`)
      .query(`
        SELECT TOP 5 p.ProductoID, p.NombreProducto, p.Presentacion, p.PrecioUnitarioVenta, p.StockActual
        FROM dbo.Productos p
        WHERE p.Activo = 1
          AND (p.NombreProducto LIKE @term OR p.Presentacion LIKE @term OR CAST(p.ProductoID AS NVARCHAR(20)) LIKE @term)
        ORDER BY p.NombreProducto
      `);

    if (!qProd.recordset.length) return res.status(404).json({ message: 'Producto no encontrado' });
    const prod = qProd.recordset[0];

    const qLotes = await pool
      .request()
      .input('ProductoID', sql.Int, prod.ProductoID)
      .query(`
        SELECT l.LoteID, l.NumeroLote, l.FechaVencimiento,
               ${meta.hasCantidadEmpaques ? 'COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,' : '0 AS CantidadEmpaques,'}
               ${meta.hasCantidadUnidades ? 'COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,' : '0 AS CantidadUnidadesMinimas,'}
               ${meta.hasTotalUnidades ? 'COALESCE(l.TotalUnidadesMinimas,0) AS TotalUnidadesMinimas,' : `${totalExpr} AS TotalUnidadesMinimas,`}
               ${meta.hasCantidad ? 'COALESCE(l.Cantidad,0) AS Cantidad' : '0 AS Cantidad'}
        FROM dbo.Lotes l
        WHERE l.ProductoID = @ProductoID AND COALESCE(l.Activo,1) = 1
      `);

    const lotes = qLotes.recordset.map((l) => {
      const factor = ensurePositiveNumber(l.CantidadUnidadesMinimas, 1) || 1;
      const total = meta.hasTotalUnidades
        ? ensurePositiveNumber(l.TotalUnidadesMinimas)
        : (meta.hasCantidad
          ? ensurePositiveNumber(l.Cantidad)
          : ensurePositiveNumber(l.CantidadEmpaques) * factor);
      return {
        lote: l.NumeroLote || l.LoteID,
        cantidad: total,
        fechaVencimiento: l.FechaVencimiento,
      };
    });

    const existenciaTotal = lotes.reduce((acc, l) => acc + ensurePositiveNumber(l.cantidad), 0);

    return res.json({
      productoId: prod.ProductoID,
      nombre: prod.NombreProducto,
      presentacion: prod.Presentacion,
      precio: Number(prod.PrecioUnitarioVenta || 0),
      existenciaTotal,
      lotes,
    });
  } catch (err) {
    console.error('consultarProductoInventario error:', err);
    return res.status(500).json({ message: 'Error al consultar producto' });
  }
};

const createProducto = async (req, res) => {
  try {
    let { Nombre, Presentacion, StockMinimo, CategoriaID, UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, Activo, UnidadMedidaEmpaque, UnidadMedidaMinima, Impuesto } = req.body || {};
    if (!Nombre) return res.status(400).json({ message: 'Falta Nombre' });
    const impuestoVal = Number(Impuesto ?? 0);
    if (!Number.isFinite(impuestoVal) || impuestoVal < 0 || impuestoVal > 100) {
      return res.status(400).json({ message: 'Impuesto debe estar entre 0 y 100' });
    }
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
    const stockMin = Number(StockMinimo || 0);
    if (!Number.isFinite(stockMin) || stockMin < 1) return res.status(400).json({ message: 'StockMinimo debe ser al menos 1' });
    let categoria = CategoriaID != null ? Number(CategoriaID) : null;
    if (categoria == null) {
      try {
        const cat = await pool.request().query('SELECT TOP 1 CategoriaID FROM CategoriasProductos ORDER BY CategoriaID');
        if (cat.recordset.length) categoria = Number(cat.recordset[0].CategoriaID);
      } catch {}
      if (categoria == null) categoria = 1;
    }

    const r = await pool
      .request()
      .input('NombreProducto', sql.NVarChar(200), Nombre)
      .input('Presentacion', sql.NVarChar(200), (Presentacion ?? '').toString())
      .input('StockMinimo', sql.Int, stockMin)
      .input('CategoriaID', sql.Int, categoria)
      .input('Activo', sql.Bit, Activo != null ? (Activo ? 1 : 0) : 1)
      .input('Impuesto', sql.Decimal(5, 2), impuestoVal)
      .input('UnidadMedidaEmpaqueID', sql.Int, Number(UnidadMedidaEmpaqueID))
      .input('UnidadMedidaMinimaID', sql.Int, Number(UnidadMedidaMinimaID))
      .query(`
        INSERT INTO Productos (NombreProducto, Presentacion, StockActual, StockMinimo, CategoriaID, Activo, FechaCreacion,
                               UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, Impuesto)
        VALUES (@NombreProducto, @Presentacion, 0, @StockMinimo, @CategoriaID, @Activo, GETDATE(),
                @UnidadMedidaEmpaqueID, @UnidadMedidaMinimaID, @Impuesto);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    const id = Number(r.recordset[0].id);
    const sel = await pool.request().input('id', sql.Int, id).query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.Impuesto,
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
    let { Nombre, Presentacion, StockMinimo, CategoriaID, Activo, UnidadMedidaEmpaqueID, UnidadMedidaMinimaID, UnidadMedidaEmpaque, UnidadMedidaMinima, Impuesto } = req.body || {};
    if (StockMinimo != null && Number(StockMinimo) < 1) return res.status(400).json({ message: 'StockMinimo debe ser al menos 1' });
    if (Impuesto != null) {
      const imp = Number(Impuesto);
      if (!Number.isFinite(imp) || imp < 0 || imp > 100) {
        return res.status(400).json({ message: 'Impuesto debe estar entre 0 y 100' });
      }
    }
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
      .input('Impuesto', sql.Decimal(5, 2), Impuesto != null ? Number(Impuesto) : null)
      .query(`
        UPDATE Productos SET
          NombreProducto = COALESCE(@NombreProducto, NombreProducto),
          Presentacion   = COALESCE(@Presentacion, Presentacion),
          StockMinimo    = COALESCE(@StockMinimo, StockMinimo),
          CategoriaID    = COALESCE(@CategoriaID, CategoriaID),
          UnidadMedidaEmpaqueID = COALESCE(@UnidadMedidaEmpaqueID, UnidadMedidaEmpaqueID),
          UnidadMedidaMinimaID = COALESCE(@UnidadMedidaMinimaID, UnidadMedidaMinimaID),
          Impuesto       = COALESCE(@Impuesto, Impuesto),
          Activo         = COALESCE(@Activo, Activo),
          FechaModificacion = GETDATE()
        WHERE ProductoID = @id;
        SELECT @@ROWCOUNT AS affected;
      `);
    if (!r.recordset[0].affected) return res.status(404).json({ message: 'Producto no encontrado' });
    const sel = await pool.request().input('id', sql.Int, Number(id)).query(`
      SELECT p.ProductoID, p.NombreProducto, p.Presentacion, p.StockActual, p.StockMinimo, p.CategoriaID, p.Activo,
             p.UnidadMedidaEmpaqueID, p.UnidadMedidaMinimaID, p.Impuesto,
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

module.exports = { getProductos, buscarProductos, getProductoByBarcode, createProducto, updateProducto, deleteProducto, consultarProductoInventario };

