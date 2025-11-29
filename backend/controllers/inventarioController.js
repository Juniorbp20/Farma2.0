// controllers/inventarioController.js
const sql = require('mssql');
const poolPromise = require('../db');
const {
  getLotesColumnInfo,
  getCantidadExpressions,
  computeUnitsFromCounts,
  splitUnitsToCounts,
  ensurePositiveNumber,
  parseDecimal,
} = require('../store/inventoryUtils');

const DEFAULT_FACTOR_UNIDADES = 1;

async function ensureHistorialTable(pool) {
  await pool
    .request()
    .query(`
      IF OBJECT_ID('dbo.InventarioLoteHistorial','U') IS NULL
      BEGIN
        CREATE TABLE dbo.InventarioLoteHistorial(
          HistorialID INT IDENTITY(1,1) PRIMARY KEY,
          LoteID INT NULL,
          UsuarioID INT NULL,
          Accion NVARCHAR(50) NOT NULL,
          Detalle NVARCHAR(4000) NULL,
          Fecha DATETIME NOT NULL DEFAULT(GETDATE())
        );
      END
    `);
}

function createRequest(scope) {
  if (scope instanceof sql.Transaction) return new sql.Request(scope);
  if (scope instanceof sql.Request) return scope;
  if (scope?.request) return scope.request();
  return new sql.Request(scope);
}

async function getResumen(req, res) {
  try {
    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();
    const { factorExpr, empaquesExpr, unidadesExpr, cantidadExpr, totalExpr } = getCantidadExpressions(meta);

    const lotesQuery = await pool.request().query(`
      SELECT
        l.LoteID,
        l.ProductoID,
        l.NumeroLote,
        l.FechaIngreso,
        l.FechaVencimiento,
        COALESCE(l.Activo,1) AS Activo,
        ${meta.hasCantidadEmpaques ? `${empaquesExpr} AS CantidadEmpaques,` : '0 AS CantidadEmpaques,'}
        ${meta.hasCantidadUnidades ? `${unidadesExpr} AS CantidadUnidadesMinimas,` : '0 AS CantidadUnidadesMinimas,'}
        ${totalExpr} AS CantidadTotalMinima,
        l.PrecioCosto,
        l.PrecioUnitarioVenta,
        l.PorcentajeDescuentoEmpaque,
        l.MarcaID,
        m.Nombre AS MarcaNombre,
        p.NombreProducto,
        p.StockMinimo,
        p.StockActual,
        p.Activo AS ProductoActivo,
        p.CategoriaID,
        cat.NombreCategoria,
        CASE WHEN l.FechaVencimiento IS NULL THEN NULL
             ELSE DATEDIFF(day, CAST(GETDATE() AS date), l.FechaVencimiento) END AS DiasRestantes
      FROM dbo.Lotes l
      INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
      LEFT JOIN dbo.CategoriasProductos cat ON cat.CategoriaID = p.CategoriaID
      LEFT JOIN dbo.Marcas m ON m.MarcaID = l.MarcaID
      WHERE COALESCE(l.Activo,1) = 1
    `);

    const productosQuery = await pool.request().query(`
      SELECT
        p.ProductoID,
        p.NombreProducto,
        p.StockMinimo,
        p.StockActual,
        p.Activo,
        p.CategoriaID,
        cat.NombreCategoria
      FROM dbo.Productos p
      LEFT JOIN dbo.CategoriasProductos cat ON cat.CategoriaID = p.CategoriaID
    `);

    const lotes = lotesQuery.recordset.map((row) => ({
      lotId: row.LoteID,
      productoId: row.ProductoID,
      numeroLote: row.NumeroLote,
      fechaIngreso: row.FechaIngreso,
      fechaVencimiento: row.FechaVencimiento,
      activo: Boolean(row.Activo ?? true),
      cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaques),
      cantidadUnidadesMinimas: ensurePositiveNumber(row.CantidadUnidadesMinimas),
      cantidadTotalMinima: ensurePositiveNumber(row.CantidadTotalMinima),
      precioCosto: parseDecimal(row.PrecioCosto),
      precioVenta: parseDecimal(row.PrecioUnitarioVenta),
      marcaId: row.MarcaID || null,
      marcaNombre: row.MarcaNombre || null,
      descuento: parseDecimal(row.PorcentajeDescuentoEmpaque, 4),
      productoNombre: row.NombreProducto,
      stockMinimoProducto: ensurePositiveNumber(row.StockMinimo),
      stockActualProducto: ensurePositiveNumber(row.StockActual),
      factorUnidad: ensurePositiveNumber(row.CantidadUnidadesMinimas, 1) || 1,
      productoActivo: Boolean(row.ProductoActivo ?? true),
      categoriaId: row.CategoriaID,
      categoriaNombre: row.NombreCategoria,
      diasRestantes:
        row.DiasRestantes !== null && row.DiasRestantes !== undefined
          ? Number(row.DiasRestantes)
          : null,
    }));

    const productosMap = new Map();
    for (const row of productosQuery.recordset) {
      productosMap.set(row.ProductoID, {
        productoId: row.ProductoID,
        nombre: row.NombreProducto,
        stockMinimo: ensurePositiveNumber(row.StockMinimo),
        stockActual: ensurePositiveNumber(row.StockActual),
        activo: Boolean(row.Activo ?? true),
        categoriaId: row.CategoriaID,
        categoriaNombre: row.NombreCategoria,
        factorUnidad: ensurePositiveNumber(row.CantidadUnidadesMinimas, 1) || 1,
        totalUnits: 0,
        totalEmpaques: 0,
        totalUnidadesMinimas: 0,
      });
    }

    for (const lote of lotes) {
      const agg = productosMap.get(lote.productoId);
      if (!agg) continue;
      agg.totalUnits += lote.cantidadTotalMinima;
      agg.totalEmpaques += lote.cantidadEmpaques;
      agg.totalUnidadesMinimas += lote.cantidadUnidadesMinimas;
    }

    const valorTotalInventario = lotes.reduce(
      (acc, lote) => acc + lote.cantidadEmpaques * lote.precioCosto,
      0
    );
    const valorTotalVenta = lotes.reduce(
      (acc, lote) => acc + lote.cantidadEmpaques * lote.precioVenta,
      0
    );

    const proximosAVencer = lotes
      .filter(
        (lote) =>
          lote.diasRestantes !== null && lote.diasRestantes >= 0 && lote.diasRestantes <= 60
      )
      .sort((a, b) => (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999));

    const totalMenor30 = proximosAVencer.filter((lote) => lote.diasRestantes <= 30).length;
    const totalEntre31y60 = proximosAVencer.filter(
      (lote) => lote.diasRestantes > 30 && lote.diasRestantes <= 60
    ).length;

    const lowStockList = [];
    const productosTabla = [];
    let activosCount = 0;

    for (const agg of productosMap.values()) {
      if (agg.activo) activosCount += 1;
      const diferencia = agg.totalUnits - agg.stockMinimo;
      if (agg.activo && agg.stockMinimo > 0 && agg.totalUnits < agg.stockMinimo) {
        lowStockList.push({
          productoId: agg.productoId,
          nombre: agg.nombre,
          categoria: agg.categoriaNombre,
          stockActual: agg.totalUnits,
          stockMinimo: agg.stockMinimo,
          deficit: agg.stockMinimo - agg.totalUnits,
        });
      }

      productosTabla.push({
        productoId: agg.productoId,
        nombre: agg.nombre,
        categoria: agg.categoriaNombre,
        stockTotalMinimo: agg.totalUnits,
        stockEmpaques: agg.totalEmpaques,
        stockUnidadesMinimas: agg.totalUnidadesMinimas,
        stockMinimo: agg.stockMinimo,
        estado: agg.activo ? 'Activo' : 'Inactivo',
        activo: agg.activo,
        factorUnidad: agg.factorUnidad,
        stockActualProducto: agg.stockActual,
        diferencia,
      });
    }

    const detalleValorInventario = lotes.map((lote) => ({
      loteId: lote.lotId,
      productoId: lote.productoId,
      producto: lote.productoNombre,
      categoria: lote.categoriaNombre,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      diasRestantes: lote.diasRestantes,
      cantidadEmpaques: lote.cantidadEmpaques,
      cantidadUnidadesMinimas: lote.cantidadUnidadesMinimas,
      cantidadTotalMinima: lote.cantidadTotalMinima,
      precioCosto: lote.precioCosto,
      precioVenta: lote.precioVenta,
      valorTotal: parseDecimal(lote.cantidadEmpaques * lote.precioCosto),
      valorVenta: parseDecimal(lote.cantidadEmpaques * lote.precioVenta),
    }));

    const detalleLotesPorVencer = proximosAVencer.map((lote) => ({
      loteId: lote.lotId,
      productoId: lote.productoId,
      producto: lote.productoNombre,
      categoria: lote.categoriaNombre,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      diasRestantes: lote.diasRestantes,
      cantidadTotalMinima: lote.cantidadTotalMinima,
      cantidadEmpaques: lote.cantidadEmpaques,
      cantidadUnidadesMinimas: lote.cantidadUnidadesMinimas,
    }));

    const detalleProductosActivos = productosTabla
      .filter((p) => p.activo)
      .map((p) => ({
        productoId: p.productoId,
        nombre: p.nombre,
        categoria: p.categoria,
        stockTotalMinimo: p.stockTotalMinimo,
        stockMinimo: p.stockMinimo,
      }));

    res.json({
      metrics: {
        inventoryValue: {
          total: parseDecimal(valorTotalInventario),
          totalVenta: parseDecimal(valorTotalVenta),
        },
        expiringLots: {
          total: proximosAVencer.length,
          lessThan30: totalMenor30,
          between31And60: totalEntre31y60,
        },
        lowStock: {
          total: lowStockList.length,
        },
        activeProducts: {
          total: activosCount,
        },
      },
      lists: {
        inventoryValue: detalleValorInventario,
        expiringLots: detalleLotesPorVencer,
        lowStock: lowStockList,
        activeProducts: detalleProductosActivos,
      },
      products: productosTabla,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('getResumen error:', err);
    res.status(500).json({ message: 'Error al obtener resumen de inventario' });
  }
}

async function getLotes(req, res) {
  try {
    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();
    const { factorExpr, empaquesExpr, unidadesExpr, cantidadExpr, totalExpr } = getCantidadExpressions(meta);

    const { productoId, estado, buscar, proximos, diasMax, incluirInactivos } = req.query || {};
    const conditions = [];
    const request = pool.request();

    if (productoId) {
      conditions.push('l.ProductoID = @productoId');
      request.input('productoId', sql.Int, Number(productoId));
    }

    if (buscar) {
      conditions.push('(p.NombreProducto LIKE @buscar OR l.NumeroLote LIKE @buscar)');
      request.input('buscar', sql.NVarChar(150), `%${buscar}%`);
    }

    const estadosPermitidos = new Set(['activos', 'inactivos', 'todos']);
    const estadoNorm = (estado || '').toLowerCase();
    if (estadoNorm && estadosPermitidos.has(estadoNorm)) {
      if (estadoNorm === 'activos') {
        conditions.push('COALESCE(l.Activo,1) = 1');
      } else if (estadoNorm === 'inactivos') {
        conditions.push('COALESCE(l.Activo,1) = 0');
      }
      // estado "todos" no agrega condiciA³n para incluir ambos
    } else if (!incluirInactivos) {
      conditions.push('COALESCE(l.Activo,1) = 1');
    }

    if (proximos === 'true' || proximos === '1') {
      conditions.push('l.FechaVencimiento IS NOT NULL');
      conditions.push('DATEDIFF(day, CAST(GETDATE() AS date), l.FechaVencimiento) BETWEEN 0 AND 60');
    } else if (diasMax) {
      conditions.push('l.FechaVencimiento IS NOT NULL');
      conditions.push('DATEDIFF(day, CAST(GETDATE() AS date), l.FechaVencimiento) BETWEEN 0 AND @diasMax');
      request.input('diasMax', sql.Int, Number(diasMax));
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        l.LoteID,
        l.ProductoID,
        l.NumeroLote,
        l.FechaIngreso,
        l.FechaVencimiento,
        COALESCE(l.Activo,1) AS Activo,
        ${meta.hasCantidadEmpaques ? `${empaquesExpr} AS CantidadEmpaques,` : '0 AS CantidadEmpaques,'}
        ${meta.hasCantidadUnidades ? `${unidadesExpr} AS CantidadUnidadesMinimas,` : '0 AS CantidadUnidadesMinimas,'}
        ${totalExpr} AS CantidadTotalMinima,
        l.PrecioCosto,
        l.PrecioUnitarioVenta,
        l.PorcentajeDescuentoEmpaque,
        l.MarcaID,
        m.Nombre AS MarcaNombre,
        p.NombreProducto,
        p.StockMinimo,
        p.StockActual,
        p.Activo AS ProductoActivo,
        cat.NombreCategoria,
        CASE WHEN l.FechaVencimiento IS NULL THEN NULL
             ELSE DATEDIFF(day, CAST(GETDATE() AS date), l.FechaVencimiento) END AS DiasRestantes
        ${meta.hasMotivoInactivacion ? ', l.MotivoInactivacion' : ''}
      FROM dbo.Lotes l
      INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
      LEFT JOIN dbo.CategoriasProductos cat ON cat.CategoriaID = p.CategoriaID
      LEFT JOIN dbo.Marcas m ON m.MarcaID = l.MarcaID
      ${whereClause}
      ORDER BY COALESCE(l.Activo,1) DESC, l.FechaVencimiento, l.LoteID
    `;

    const result = await request.query(query);
    const lotes = result.recordset.map((row) => {
      const diasRestantes =
        row.DiasRestantes !== null && row.DiasRestantes !== undefined
          ? Number(row.DiasRestantes)
          : null;
      let alerta = null;
      if (diasRestantes !== null) {
        if (diasRestantes < 0) alerta = 'vencido';
        else if (diasRestantes <= 30) alerta = 'critico';
        else if (diasRestantes <= 60) alerta = 'aviso';
      }
      return {
        loteId: row.LoteID,
        productoId: row.ProductoID,
        producto: row.NombreProducto,
        categoria: row.NombreCategoria,
        numeroLote: row.NumeroLote,
        fechaIngreso: row.FechaIngreso,
        fechaVencimiento: row.FechaVencimiento,
        diasRestantes,
        activo: Boolean(row.Activo),
        estado: Boolean(row.Activo) ? 'Activo' : 'Inactivo',
        marcaId: row.MarcaID || null,
        marcaNombre: row.MarcaNombre || null,
        cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaques),
        cantidadUnidadesMinimas: ensurePositiveNumber(row.CantidadUnidadesMinimas),
        cantidadTotalMinima: ensurePositiveNumber(row.CantidadTotalMinima),
        precioCosto: parseDecimal(row.PrecioCosto),
        precioVenta: parseDecimal(row.PrecioUnitarioVenta),
        descuento: parseDecimal(row.PorcentajeDescuentoEmpaque, 4),
        stockMinimoProducto: ensurePositiveNumber(row.StockMinimo),
        stockActualProducto: ensurePositiveNumber(row.StockActual),
        factorUnidad: ensurePositiveNumber(row.CantidadUnidadesMinimas, 1) || 1,
        alertaVencimiento: alerta,
        motivoInactivacion: meta.hasMotivoInactivacion ? row.MotivoInactivacion || null : null,
      };
    });

    res.json(lotes);
  } catch (err) {
    console.error('getLotes error:', err);
    res.status(500).json({ message: 'Error al obtener lotes' });
  }
}

async function getLoteDetalle(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'LoteID requerido' });

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();
    const { factorExpr, empaquesExpr, unidadesExpr, cantidadExpr, totalExpr } = getCantidadExpressions(meta);

    const request = pool.request().input('id', sql.Int, Number(id));
    const loteResult = await request.query(`
      SELECT
        l.LoteID,
        l.ProductoID,
        l.NumeroLote,
        l.FechaIngreso,
        l.FechaVencimiento,
        COALESCE(l.Activo,1) AS Activo,
        ${meta.hasCantidadEmpaques ? `${empaquesExpr} AS CantidadEmpaques,` : '0 AS CantidadEmpaques,'}
        ${meta.hasCantidadUnidades ? `${unidadesExpr} AS CantidadUnidadesMinimas,` : '0 AS CantidadUnidadesMinimas,'}
        ${totalExpr} AS CantidadTotalMinima,
        l.PrecioCosto,
        l.PrecioUnitarioVenta,
        l.PorcentajeDescuentoEmpaque,
        l.MarcaID,
        m.Nombre AS MarcaNombre,
        p.NombreProducto,
        p.StockMinimo,
        p.StockActual,
        p.Activo AS ProductoActivo,
        cat.NombreCategoria
        ${meta.hasMotivoInactivacion ? ', l.MotivoInactivacion' : ''}
      FROM dbo.Lotes l
      INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
      LEFT JOIN dbo.CategoriasProductos cat ON cat.CategoriaID = p.CategoriaID
      LEFT JOIN dbo.Marcas m ON m.MarcaID = l.MarcaID
      WHERE l.LoteID = @id
    `);

    if (!loteResult.recordset.length) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    const row = loteResult.recordset[0];
    const factor = ensurePositiveNumber(row.CantidadUnidadesMinimas, 1) || 1;
    const diasRestantes =
      row.FechaVencimiento == null
        ? null
        : Math.floor(
            (new Date(row.FechaVencimiento).setHours(0, 0, 0, 0) -
              new Date().setHours(0, 0, 0, 0)) /
              (1000 * 60 * 60 * 24)
          );

    await ensureHistorialTable(pool);
    const historial = await pool
      .request()
      .input('loteId', sql.Int, Number(id))
      .query(`
        SELECT HistorialID, LoteID, UsuarioID, Accion, Detalle, Fecha
        FROM dbo.InventarioLoteHistorial
        WHERE LoteID = @loteId
        ORDER BY Fecha DESC, HistorialID DESC
      `);

    res.json({
      loteId: row.LoteID,
      productoId: row.ProductoID,
      producto: row.NombreProducto,
      categoria: row.NombreCategoria,
      numeroLote: row.NumeroLote,
      fechaIngreso: row.FechaIngreso,
      fechaVencimiento: row.FechaVencimiento,
      diasRestantes,
      activo: Boolean(row.Activo),
      cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaques),
      cantidadUnidadesMinimas: ensurePositiveNumber(row.CantidadUnidadesMinimas),
      cantidadTotalMinima: ensurePositiveNumber(row.CantidadTotalMinima),
      precioCosto: parseDecimal(row.PrecioCosto),
      precioVenta: parseDecimal(row.PrecioUnitarioVenta),
      marcaId: row.MarcaID || null,
      marcaNombre: row.MarcaNombre || null,
      descuento: parseDecimal(row.PorcentajeDescuentoEmpaque, 4),
      stockMinimoProducto: ensurePositiveNumber(row.StockMinimo),
      stockActualProducto: ensurePositiveNumber(row.StockActual),
      factorUnidad: factor,
      motivoInactivacion: meta.hasMotivoInactivacion ? row.MotivoInactivacion || null : null,
      historial: historial.recordset,
    });
  } catch (err) {
    console.error('getLoteDetalle error:', err);
    res.status(500).json({ message: 'Error al obtener detalle de lote' });
  }
}

async function addLote(req, res) {
  try {
    const {
      ProductoID,
      NumeroLote,
      FechaVencimiento,
      CantidadEmpaques = 0,
      CantidadUnidadesMinimas = 0,
      CantidadTotal,
      PrecioCosto,
      PrecioVenta,
      Descuento = 0,
      MarcaID,
    } = req.body || {};

    if (!ProductoID) return res.status(400).json({ message: 'ProductoID es requerido' });
    if (!NumeroLote) return res.status(400).json({ message: 'Numero de lote es requerido' });
    if (!FechaVencimiento) {
      return res.status(400).json({ message: 'Fecha de vencimiento es requerida' });
    }

    const fechaVenc = new Date(FechaVencimiento);
    if (Number.isNaN(fechaVenc.getTime())) {
      return res.status(400).json({ message: 'Fecha de vencimiento invA¡lida' });
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaVenc < hoy) {
      return res.status(400).json({ message: 'El vencimiento debe ser posterior a hoy' });
    }

    const costo = parseDecimal(PrecioCosto);
    const venta = parseDecimal(PrecioVenta);
    if (costo <= 0) return res.status(400).json({ message: 'Precio de costo debe ser mayor a 0' });
    if (venta < costo) {
      return res.status(400).json({ message: 'El precio de venta no puede ser menor al costo' });
    }

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();
    const productoQuery = await pool
      .request()
      .input('ProductoID', sql.Int, Number(ProductoID))
      .query(`
        SELECT ProductoID, NombreProducto, Activo
        FROM dbo.Productos
        WHERE ProductoID = @ProductoID
      `);

    if (!productoQuery.recordset.length) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    const producto = productoQuery.recordset[0];
    if (!producto.Activo) {
      return res.status(400).json({ message: 'El producto estA¡ inactivo' });
    }

    const marcaIdRaw = MarcaID ?? req.body?.marcaId;
    const marcaId = marcaIdRaw != null ? Number(marcaIdRaw) : null;
    if (!marcaId) {
      return res.status(400).json({ message: 'La marca es requerida' });
    }
    const marcaQuery = await pool
      .request()
      .input('MarcaID', sql.Int, marcaId)
      .query(`
        SELECT MarcaID, Activo
        FROM dbo.Marcas
        WHERE MarcaID = @MarcaID
      `);
    if (!marcaQuery.recordset.length) {
      return res.status(404).json({ message: 'Marca no encontrada' });
    }
    if (marcaQuery.recordset[0].Activo === false || marcaQuery.recordset[0].Activo === 0) {
      return res.status(400).json({ message: 'La marca estA¡ inactiva' });
    }

    const factor = meta.hasCantidadUnidades
      ? ensurePositiveNumber(CantidadUnidadesMinimas, 0)
      : DEFAULT_FACTOR_UNIDADES;
    if (meta.hasCantidadUnidades && factor <= 0) {
      return res.status(400).json({ message: 'Las unidades por empaque deben ser mayores a 0' });
    }
    const unidadesTotales = meta.hasCantidad
      ? ensurePositiveNumber(
          CantidadTotal ??
            req.body.Cantidad ??
            req.body.CantidadTotalMinima ??
            ensurePositiveNumber(CantidadEmpaques, 0) * factor,
          0
        )
      : computeUnitsFromCounts({ empaques: CantidadEmpaques }, factor, meta);
    const unidadesTotalesInt = Math.round(unidadesTotales);

    if (unidadesTotales <= 0) {
      return res.status(400).json({ message: 'La cantidad total debe ser mayor a 0' });
    }

    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      const insertColumns = [
        'ProductoID',
        'NumeroLote',
        'FechaVencimiento',
        'FechaIngreso',
        'Activo',
        'PrecioCosto',
        'PrecioUnitarioVenta',
        'PorcentajeDescuentoEmpaque',
        'MarcaID',
      ];
      const insertValues = [
        '@ProductoID',
        '@NumeroLote',
        '@FechaVencimiento',
        'GETDATE()',
        '1',
        '@PrecioCosto',
        '@PrecioVenta',
        '@Descuento',
        '@MarcaID',
      ];

      if (meta.hasCantidadEmpaques) insertColumns.push('CantidadEmpaques');
      if (meta.hasCantidadUnidades) insertColumns.push('CantidadUnidadesMinimas');
      if (meta.hasCantidad) insertColumns.push('Cantidad');
      if (meta.hasTotalUnidades) insertColumns.push('TotalUnidadesMinimas');

      if (meta.hasCantidadEmpaques) insertValues.push('@CantidadEmpaques');
      if (meta.hasCantidadUnidades) insertValues.push('@CantidadUnidadesMinimas');
      if (meta.hasCantidad) insertValues.push('@CantidadTotal');
      if (meta.hasTotalUnidades) insertValues.push('@TotalUnidadesMinimas');

      const reqTx = new sql.Request(tx)
        .input('ProductoID', sql.Int, Number(ProductoID))
        .input('NumeroLote', sql.NVarChar(100), String(NumeroLote))
        .input('FechaVencimiento', sql.Date, fechaVenc)
        .input('PrecioCosto', sql.Decimal(10, 2), costo)
        .input('PrecioVenta', sql.Decimal(10, 2), venta)
        .input('Descuento', sql.Decimal(5, 4), parseDecimal(Descuento, 4))
        .input('MarcaID', sql.Int, marcaId);

      if (meta.hasCantidadEmpaques) {
        reqTx.input('CantidadEmpaques', sql.Int, Math.round(ensurePositiveNumber(CantidadEmpaques)));
      }
      if (meta.hasCantidadUnidades) {
        reqTx.input('CantidadUnidadesMinimas', sql.Int, Math.round(factor));
      }
      if (meta.hasCantidad) {
        reqTx.input('CantidadTotal', sql.Int, unidadesTotalesInt);
      }
      if (meta.hasTotalUnidades) {
        reqTx.input('TotalUnidadesMinimas', sql.Int, unidadesTotalesInt);
      }

      const insertQuery = `
        INSERT INTO dbo.Lotes (${insertColumns.join(', ')})
        OUTPUT INSERTED.LoteID
        VALUES (${insertValues.join(', ')});
      `;
      const inserted = await reqTx.query(insertQuery);
      const loteId = inserted.recordset[0]?.LoteID;

      await new sql.Request(tx)
        .input('ProductoID', sql.Int, Number(ProductoID))
        .input('Cantidad', sql.Int, unidadesTotalesInt)
        .query(`
          UPDATE dbo.Productos
          SET StockActual = COALESCE(StockActual,0) + @Cantidad,
              FechaModificacion = GETDATE()
          WHERE ProductoID = @ProductoID;
        `);

      await tx.commit();
      res.status(201).json({ message: 'Lote agregado', loteId });
    } catch (innerErr) {
      await tx.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error('addLote error:', err);
    res.status(500).json({ message: 'Error al agregar lote' });
  }
}

async function updateLote(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'LoteID requerido' });

    const {
      FechaVencimiento,
      PrecioCosto,
      PrecioVenta,
      Descuento,
      NumeroLote,
      MarcaID,
    } = req.body || {};

    const marcaIdPayload = MarcaID ?? req.body?.marcaId;

    if (
      FechaVencimiento === undefined &&
      PrecioCosto === undefined &&
      PrecioVenta === undefined &&
      Descuento === undefined &&
      NumeroLote === undefined &&
      marcaIdPayload === undefined
    ) {
      return res.status(400).json({ message: 'No hay cambios para aplicar' });
    }

    const pool = await poolPromise;
    const detalle = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        SELECT TOP 1
          l.LoteID,
          l.ProductoID,
          l.NumeroLote,
          l.FechaVencimiento,
          l.PrecioCosto,
          l.PrecioUnitarioVenta,
          l.PorcentajeDescuentoEmpaque,
          l.MarcaID
        FROM dbo.Lotes l
        WHERE l.LoteID = @id
      `);

    if (!detalle.recordset.length) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    const loteActual = detalle.recordset[0];

    const updates = [];
    const inputDefs = [{ name: 'LoteID', type: sql.Int, value: Number(id) }];
    const cambios = [];

    if (FechaVencimiento !== undefined) {
      const nuevaFecha = new Date(FechaVencimiento);
      if (Number.isNaN(nuevaFecha.getTime())) {
        return res.status(400).json({ message: 'Fecha de vencimiento invA¡lida' });
      }
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (nuevaFecha < hoy) {
        return res.status(400).json({ message: 'El vencimiento debe ser posterior a hoy' });
      }
      updates.push('FechaVencimiento = @FechaVencimiento');
      inputDefs.push({ name: 'FechaVencimiento', type: sql.Date, value: nuevaFecha });
      if (
        loteActual.FechaVencimiento &&
        nuevaFecha.toISOString().slice(0, 10) !==
          new Date(loteActual.FechaVencimiento).toISOString().slice(0, 10)
      ) {
        const anterior = new Date(loteActual.FechaVencimiento)
          .toISOString()
          .slice(0, 10);
        const nueva = nuevaFecha.toISOString().slice(0, 10);
        cambios.push(`Fecha vencimiento: ${anterior} -> ${nueva}`);
      }
    }

    if (NumeroLote !== undefined && NumeroLote !== loteActual.NumeroLote) {
      updates.push('NumeroLote = @NumeroLote');
      inputDefs.push({ name: 'NumeroLote', type: sql.NVarChar(100), value: String(NumeroLote) });
      cambios.push(`Numero lote: ${loteActual.NumeroLote || '-'} -> ${NumeroLote}`);
    }

    if (marcaIdPayload !== undefined) {
      const marcaId = Number(marcaIdPayload);
      if (!Number.isInteger(marcaId) || marcaId <= 0) {
        return res.status(400).json({ message: 'Marca invA¡lida' });
      }
      const marcaQuery = await pool
        .request()
        .input('MarcaID', sql.Int, marcaId)
        .query(`
          SELECT MarcaID, Nombre, COALESCE(Activo,1) AS Activo
          FROM dbo.Marcas
          WHERE MarcaID = @MarcaID
        `);
      if (!marcaQuery.recordset.length) {
        return res.status(404).json({ message: 'Marca no encontrada' });
      }
      const nuevaMarcaNombre = marcaQuery.recordset[0].Nombre || '';
      if (!marcaQuery.recordset[0].Activo) {
        return res.status(400).json({ message: 'La marca estA¡ inactiva' });
      }
      updates.push('MarcaID = @MarcaID');
      inputDefs.push({ name: 'MarcaID', type: sql.Int, value: marcaId });
      if (Number(loteActual.MarcaID || 0) !== marcaId) {
        let marcaAnteriorNombre = '';
        if (loteActual.MarcaID) {
          const anteriorQuery = await pool
            .request()
            .input('MarcaID', sql.Int, Number(loteActual.MarcaID))
            .query('SELECT Nombre FROM dbo.Marcas WHERE MarcaID = @MarcaID');
          marcaAnteriorNombre = anteriorQuery.recordset[0]?.Nombre || '';
        }
        cambios.push(
          `Marca: ${marcaAnteriorNombre || loteActual.MarcaID || '-'} -> ${
            nuevaMarcaNombre || marcaId
          }`
        );
      }
    }

    if (PrecioCosto !== undefined) {
      const nuevoCosto = parseDecimal(PrecioCosto);
      if (nuevoCosto <= 0) {
        return res.status(400).json({ message: 'Precio de costo debe ser mayor a 0' });
      }
      updates.push('PrecioCosto = @PrecioCosto');
      inputDefs.push({ name: 'PrecioCosto', type: sql.Decimal(10, 2), value: nuevoCosto });
      if (parseDecimal(loteActual.PrecioCosto) !== nuevoCosto) {
        cambios.push(`Precio costo: ${parseDecimal(loteActual.PrecioCosto)} -> ${nuevoCosto}`);
      }
    }

    if (PrecioVenta !== undefined) {
      const nuevoVenta = parseDecimal(PrecioVenta);
      if (nuevoVenta <= 0) {
        return res.status(400).json({ message: 'Precio de venta debe ser mayor a 0' });
      }
      if (
        (PrecioCosto !== undefined && parseDecimal(PrecioCosto) > nuevoVenta) ||
        (PrecioCosto === undefined && parseDecimal(loteActual.PrecioCosto) > nuevoVenta)
      ) {
        return res
          .status(400)
          .json({ message: 'El precio de venta no puede ser menor al precio de costo' });
      }
      updates.push('PrecioUnitarioVenta = @PrecioVenta');
      inputDefs.push({ name: 'PrecioVenta', type: sql.Decimal(10, 2), value: nuevoVenta });
      if (parseDecimal(loteActual.PrecioUnitarioVenta) !== nuevoVenta) {
        cambios.push(
          `Precio venta: ${parseDecimal(loteActual.PrecioUnitarioVenta)} -> ${nuevoVenta}`
        );
      }
    }

    if (Descuento !== undefined) {
      const nuevoDesc = parseDecimal(Descuento, 4);
      updates.push('PorcentajeDescuentoEmpaque = @Descuento');
      inputDefs.push({ name: 'Descuento', type: sql.Decimal(5, 4), value: nuevoDesc });
      if (parseDecimal(loteActual.PorcentajeDescuentoEmpaque, 4) !== nuevoDesc) {
        cambios.push(
          `Descuento: ${parseDecimal(loteActual.PorcentajeDescuentoEmpaque, 4)} -> ${nuevoDesc}`
        );
      }
    }

    if (!updates.length) {
      return res.status(200).json({ message: 'Sin cambios' });
    }

    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      const reqTx = new sql.Request(tx);
      inputDefs.forEach((def) => reqTx.input(def.name, def.type, def.value));
      await reqTx.query(`UPDATE dbo.Lotes SET ${updates.join(', ')} WHERE LoteID = @LoteID;`);

      if (cambios.length) {
        await ensureHistorialTable(pool);
        const detalleHistorial = [...cambios];
        await new sql.Request(tx)
          .input('LoteID', sql.Int, Number(id))
          .input('UsuarioID', sql.Int, req.user?.sub ? Number(req.user.sub) : null)
          .input('Accion', sql.NVarChar(50), 'actualizacion')
          .input('Detalle', sql.NVarChar(4000), detalleHistorial.join(' | '))
          .query(`
            INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle)
            VALUES (@LoteID, @UsuarioID, @Accion, @Detalle);
          `);
      }
      await tx.commit();
      res.json({ message: 'Lote actualizado' });
    } catch (innerErr) {
      await tx.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error('updateLote error:', err);
    res.status(500).json({ message: 'Error al actualizar lote' });
  }
}

async function desactivarLote(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'LoteID requerido' });
    const motivoInput = (req.body?.motivo ?? req.body?.Motivo ?? '').toString().trim();
    if (!motivoInput) {
      return res.status(400).json({ message: 'Motivo requerido para desactivar el lote' });
    }

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();

    const detalle = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        SELECT
          l.LoteID,
          l.ProductoID,
          COALESCE(l.Activo,1) AS Activo,
          ${meta.hasCantidadEmpaques ? 'COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,' : '0 AS CantidadEmpaques,'}
          ${meta.hasCantidadUnidades ? 'COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,' : '0 AS CantidadUnidadesMinimas,'}
          ${meta.hasCantidad ? 'COALESCE(l.Cantidad,0) AS Cantidad' : '0 AS Cantidad'}
        FROM dbo.Lotes l
        INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
        WHERE l.LoteID = @id
      `);

    if (!detalle.recordset.length) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    const lote = detalle.recordset[0];
    if (!lote.Activo) {
      return res.status(200).json({ message: 'El lote ya estA¡ inactivo' });
    }

    const factor = ensurePositiveNumber(lote.CantidadUnidadesMinimas, 1) || 1;
    const totalUnidades = computeUnitsFromCounts(
      {
        empaques: lote.CantidadEmpaques,
        unidades: lote.CantidadUnidadesMinimas,
        cantidad: lote.Cantidad,
      },
      factor,
      meta
    );

    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      const updateParts = ['Activo = 0'];
      const reqTx = new sql.Request(tx).input('LoteID', sql.Int, Number(id));
      if (meta.hasMotivoInactivacion) {
        updateParts.push('MotivoInactivacion = @Motivo');
        reqTx.input('Motivo', sql.NVarChar(400), motivoInput);
      }
      await reqTx.query(`UPDATE dbo.Lotes SET ${updateParts.join(', ')} WHERE LoteID = @LoteID;`);

      await new sql.Request(tx)
        .input('ProductoID', sql.Int, Number(lote.ProductoID))
        .input('Cantidad', sql.Int, Math.round(totalUnidades))
        .query(`
          UPDATE dbo.Productos
          SET StockActual = CASE
              WHEN StockActual IS NULL THEN 0
              WHEN StockActual <= @Cantidad THEN 0
              ELSE StockActual - @Cantidad
            END,
            FechaModificacion = GETDATE()
          WHERE ProductoID = @ProductoID;
        `);

      await ensureHistorialTable(pool);
      await new sql.Request(tx)
        .input('LoteID', sql.Int, Number(id))
        .input('UsuarioID', sql.Int, req.user?.sub ? Number(req.user.sub) : null)
        .input('Accion', sql.NVarChar(50), 'desactivacion')
        .input('Detalle', sql.NVarChar(4000), `Desactivado manualmente. Motivo: ${motivoInput}`)
        .query(`
          INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle)
          VALUES (@LoteID, @UsuarioID, @Accion, @Detalle);
        `);

      await tx.commit();
      res.json({ message: 'Lote desactivado' });
    } catch (innerErr) {
      await tx.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error('desactivarLote error:', err);
    res.status(500).json({ message: 'Error al desactivar lote' });
  }
}

async function reactivarLote(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'LoteID requerido' });

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();

    const detalle = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        SELECT
          l.LoteID,
          l.ProductoID,
          COALESCE(l.Activo,1) AS Activo,
          ${meta.hasCantidadEmpaques ? 'COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,' : '0 AS CantidadEmpaques,'}
          ${meta.hasCantidadUnidades ? 'COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,' : '0 AS CantidadUnidadesMinimas,'}
          ${meta.hasCantidad ? 'COALESCE(l.Cantidad,0) AS Cantidad' : '0 AS Cantidad'}
        FROM dbo.Lotes l
        INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
        WHERE l.LoteID = @id
      `);

    if (!detalle.recordset.length) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }
    const lote = detalle.recordset[0];
    if (lote.Activo) {
      return res.status(200).json({ message: 'El lote ya esta activo' });
    }

    const factor = ensurePositiveNumber(lote.CantidadUnidadesMinimas, 1) || 1;
    const totalUnidades = computeUnitsFromCounts(
      {
        empaques: lote.CantidadEmpaques,
        unidades: lote.CantidadUnidadesMinimas,
        cantidad: lote.Cantidad,
      },
      factor,
      meta
    );

    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      const updateParts = ['Activo = 1'];
      const reqTx = new sql.Request(tx).input('LoteID', sql.Int, Number(id));
      if (meta.hasMotivoInactivacion) {
        updateParts.push('MotivoInactivacion = NULL');
      }
      await reqTx.query(`UPDATE dbo.Lotes SET ${updateParts.join(', ')} WHERE LoteID = @LoteID;`);

      await new sql.Request(tx)
        .input('ProductoID', sql.Int, Number(lote.ProductoID))
        .input('Cantidad', sql.Int, Math.round(totalUnidades))
        .query(`
          UPDATE dbo.Productos
          SET StockActual = COALESCE(StockActual,0) + @Cantidad,
              FechaModificacion = GETDATE()
          WHERE ProductoID = @ProductoID;
        `);

      await ensureHistorialTable(pool);
      await new sql.Request(tx)
        .input('LoteID', sql.Int, Number(id))
        .input('UsuarioID', sql.Int, req.user?.sub ? Number(req.user.sub) : null)
        .input('Accion', sql.NVarChar(50), 'reactivacion')
        .input('Detalle', sql.NVarChar(4000), 'Reactivado manualmente.')
        .query(`
          INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle)
          VALUES (@LoteID, @UsuarioID, @Accion, @Detalle);
        `);

      await tx.commit();
      res.json({ message: 'Lote reactivado' });
    } catch (innerErr) {
      await tx.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error('reactivarLote error:', err);
    res.status(500).json({ message: 'Error al reactivar lote' });
  }
}

async function getMarcasActivas(req, res) {
  try {
    const incluirInactivas =
      req.query?.incluirInactivas === 'true' || req.query?.incluirInactivas === '1';
    const pool = await poolPromise;
    const query = `
      SELECT MarcaID, Nombre, Laboratorio, COALESCE(Activo,1) AS Activo, FechaCreacion
      FROM dbo.Marcas
      ${incluirInactivas ? '' : 'WHERE COALESCE(Activo,1) = 1'}
      ORDER BY Nombre ASC
    `;
    const result = await pool.request().query(query);
    const marcas = result.recordset.map((row) => ({
      marcaId: row.MarcaID,
      nombre: row.Nombre,
      laboratorio: row.Laboratorio,
      activo: Boolean(row.Activo),
      fechaCreacion: row.FechaCreacion,
    }));
    res.json(marcas);
  } catch (err) {
    console.error('getMarcasActivas error:', err);
    res.status(500).json({ message: 'Error al obtener las marcas' });
  }
}

async function consumirDesdeLotes(scope, productoId, unidadesSolicitadas) {
  const meta = await getLotesColumnInfo();
  const requestProducto = createRequest(scope)
    .input('ProductoID', sql.Int, Number(productoId));
  const productoResult = await requestProducto.query(`
    SELECT ProductoID
    FROM dbo.Productos
    WHERE ProductoID = @ProductoID
  `);
  if (!productoResult.recordset.length) return 0;

  const requestLotes = createRequest(scope)
    .input('ProductoID', sql.Int, Number(productoId));
  const lotesQuery = await requestLotes.query(`
    SELECT
      LoteID,
      COALESCE(Activo,1) AS Activo
      ${meta.hasCantidadEmpaques ? ', COALESCE(CantidadEmpaques,0) AS CantidadEmpaques' : ''}
      ${meta.hasCantidadUnidades ? ', COALESCE(CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas' : ''}
      ${meta.hasCantidad ? ', COALESCE(Cantidad,0) AS Cantidad' : ''}
    FROM dbo.Lotes
    WHERE ProductoID = @ProductoID AND COALESCE(Activo,1) = 1
    ORDER BY FechaVencimiento, LoteID
  `);

  let restante = Math.max(0, Number(unidadesSolicitadas) || 0);
  let consumido = 0;
  for (const row of lotesQuery.recordset) {
    if (restante <= 0) break;
    const factor = meta.hasCantidadUnidades
      ? ensurePositiveNumber(row.CantidadUnidadesMinimas, 1) || 1
      : DEFAULT_FACTOR_UNIDADES;
    const totalUnidadLote = computeUnitsFromCounts(
      {
        empaques: row.CantidadEmpaques,
        unidades: row.CantidadUnidadesMinimas,
        cantidad: row.Cantidad,
      },
      factor,
      meta
    );
    if (totalUnidadLote <= 0) continue;
    const tomar = Math.min(restante, totalUnidadLote);
    const unidadesRestantes = totalUnidadLote - tomar;
    const nuevosValores = splitUnitsToCounts(unidadesRestantes, factor, meta);

    const updateParts = [];
    const reqUpdate = createRequest(scope).input('LoteID', sql.Int, row.LoteID);
    if (meta.hasCantidad) {
      updateParts.push('Cantidad = @Cantidad');
      reqUpdate.input('Cantidad', sql.Int, Math.round(nuevosValores.cantidad ?? unidadesRestantes));
    }
    if (meta.hasCantidadEmpaques) {
      updateParts.push('CantidadEmpaques = @CantidadEmpaques');
      reqUpdate.input(
        'CantidadEmpaques',
        sql.Int,
        Math.round(nuevosValores.empaques ?? 0)
      );
    }
    if (meta.hasCantidadUnidades) {
      updateParts.push('CantidadUnidadesMinimas = @CantidadUnidades');
      reqUpdate.input(
        'CantidadUnidades',
        sql.Int,
        Math.round(nuevosValores.unidades ?? 0)
      );
    }
    if (updateParts.length) {
      await reqUpdate.query(`UPDATE dbo.Lotes SET ${updateParts.join(', ')} WHERE LoteID = @LoteID;`);
    }
    restante -= tomar;
    consumido += tomar;
  }

  if (consumido > 0) {
    await createRequest(scope)
      .input('ProductoID', sql.Int, Number(productoId))
      .input('Cantidad', sql.Int, Math.round(consumido))
      .query(`
        UPDATE dbo.Productos
        SET StockActual = CASE
            WHEN StockActual IS NULL THEN 0
            WHEN StockActual <= @Cantidad THEN 0
            ELSE StockActual - @Cantidad
          END,
          FechaModificacion = GETDATE()
        WHERE ProductoID = @ProductoID;
      `);
  }

  return consumido;
}

async function ajustarStock(req, res) {
  try {
    const { ProductoID, Cantidad } = req.body || {};
    const cantidadNum = Number(Cantidad);
    if (!ProductoID || !Number.isFinite(cantidadNum) || cantidadNum === 0) {
      return res.status(400).json({ message: 'Datos invA¡lidos para ajuste' });
    }

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();

    const productResult = await pool
      .request()
      .input('ProductoID', sql.Int, Number(ProductoID))
      .query(`
        SELECT ProductoID, Activo
        FROM dbo.Productos
        WHERE ProductoID = @ProductoID
      `);

    if (!productResult.recordset.length) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    const producto = productResult.recordset[0];
    if (!producto.Activo) {
      return res.status(400).json({ message: 'El producto estA¡ inactivo' });
    }

    const factor = DEFAULT_FACTOR_UNIDADES;
    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      if (cantidadNum > 0) {
        const unidadesTotales = meta.hasCantidad
          ? Math.round(cantidadNum)
          : Math.round(cantidadNum * factor);
        const counts = splitUnitsToCounts(unidadesTotales, factor, meta);

        const insertColumns = [
          'ProductoID',
          'NumeroLote',
          'FechaVencimiento',
          'FechaIngreso',
          'Activo',
          'PrecioCosto',
          'PrecioUnitarioVenta',
          'PorcentajeDescuentoEmpaque',
        ];
        const insertValues = [
          '@ProductoID',
          '@NumeroLote',
          'NULL',
          'GETDATE()',
          '1',
          '0',
          '0',
          '0',
        ];
        if (meta.hasCantidadEmpaques) insertColumns.push('CantidadEmpaques');
        if (meta.hasCantidadUnidades) insertColumns.push('CantidadUnidadesMinimas');
        if (meta.hasCantidad) insertColumns.push('Cantidad');
        if (meta.hasTotalUnidades) insertColumns.push('TotalUnidadesMinimas');

        if (meta.hasCantidadEmpaques) insertValues.push('@CantidadEmpaques');
        if (meta.hasCantidadUnidades) insertValues.push('@CantidadUnidades');
        if (meta.hasCantidad) insertValues.push('@CantidadTotal');
        if (meta.hasTotalUnidades) insertValues.push('@TotalUnidadesMinimas');

        const reqTx = new sql.Request(tx)
          .input('ProductoID', sql.Int, Number(ProductoID))
          .input('NumeroLote', sql.NVarChar(100), `AJUSTE-${Date.now()}`);

        if (meta.hasCantidadEmpaques) {
          reqTx.input('CantidadEmpaques', sql.Int, Math.round(counts.empaques ?? 0));
        }
        if (meta.hasCantidadUnidades) {
          reqTx.input('CantidadUnidades', sql.Int, Math.round(counts.unidades ?? 0));
        }
        if (meta.hasCantidad) {
          reqTx.input('CantidadTotal', sql.Int, Math.round(counts.cantidad ?? unidadesTotales));
        }
        if (meta.hasTotalUnidades) {
          reqTx.input('TotalUnidadesMinimas', sql.Int, Math.round(unidadesTotales));
        }

        await reqTx.query(`
          INSERT INTO dbo.Lotes (${insertColumns.join(', ')})
          VALUES (${insertValues.join(', ')});
        `);

        await new sql.Request(tx)
          .input('ProductoID', sql.Int, Number(ProductoID))
          .input('Cantidad', sql.Int, Math.round(unidadesTotales))
          .query(`
            UPDATE dbo.Productos
            SET StockActual = COALESCE(StockActual,0) + @Cantidad,
                FechaModificacion = GETDATE()
            WHERE ProductoID = @ProductoID;
          `);
      } else {
        const extraido = await consumirDesdeLotes(tx, ProductoID, Math.abs(cantidadNum));
        if (extraido <= 0) {
          await tx.rollback();
          return res.status(400).json({ message: 'No fue posible extraer stock del producto' });
        }
      }

      await ensureHistorialTable(pool);
      await new sql.Request(tx)
        .input('LoteID', sql.Int, null)
        .input('UsuarioID', sql.Int, req.user?.sub ? Number(req.user.sub) : null)
        .input('Accion', sql.NVarChar(50), 'ajuste')
        .input('Detalle', sql.NVarChar(4000), `Ajuste manual producto ${ProductoID}: ${cantidadNum}`)
        .query(`
          INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle)
          VALUES (@LoteID, @UsuarioID, @Accion, @Detalle);
        `);

      await tx.commit();
      res.json({ message: 'Ajuste aplicado' });
    } catch (innerErr) {
      await tx.rollback();
      throw innerErr;
    }
  } catch (err) {
    console.error('ajustarStock error:', err);
    res.status(500).json({ message: 'Error al ajustar stock' });
  }
}

async function getMovimientosRecientes(req, res) {
  try {
    const pool = await poolPromise;
    const limite = Number(req.query.limit) > 0 ? Number(req.query.limit) : 20;
    const filtroProducto = (req.query.producto || '').trim();

    const q = await pool
      .request()
      .input('limite', sql.Int, limite)
      .input('prod', sql.NVarChar(200), filtroProducto || null)
      .query(`
        SELECT TOP (@limite)
          l.LoteID,
          l.ProductoID,
          p.NombreProducto,
          l.NumeroLote,
          l.FechaIngreso,
          l.FechaVencimiento,
          COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,
          COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,
          CASE
            WHEN COL_LENGTH('dbo.Lotes','TotalUnidadesMinimas') IS NOT NULL
              THEN COALESCE(l.TotalUnidadesMinimas, COALESCE(l.CantidadEmpaques,0) * COALESCE(l.CantidadUnidadesMinimas,1))
            ELSE COALESCE(l.CantidadEmpaques,0) * COALESCE(l.CantidadUnidadesMinimas,1)
          END AS TotalUnidades,
          l.PrecioCosto
        FROM dbo.Lotes l
        INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
        WHERE (@prod IS NULL OR p.NombreProducto LIKE '%' + @prod + '%')
        ORDER BY COALESCE(l.FechaIngreso, l.LoteID) DESC, l.LoteID DESC
      `);

    const movimientos = q.recordset.map((row) => ({
      loteId: row.LoteID,
      productoId: row.ProductoID,
      producto: row.NombreProducto,
      numeroLote: row.NumeroLote,
      fechaIngreso: row.FechaIngreso,
      fechaVencimiento: row.FechaVencimiento,
      cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaques),
      cantidadUnidadesMinimas: ensurePositiveNumber(row.CantidadUnidadesMinimas),
      totalUnidades: ensurePositiveNumber(row.TotalUnidades),
      precioCosto: parseDecimal(row.PrecioCosto),
    }));

    return res.json(movimientos);
  } catch (err) {
    console.error('getMovimientosRecientes error:', err);
    return res.status(500).json({ message: 'Error al obtener movimientos de inventario' });
  }
}

module.exports = {
  getResumen,
  getLotes,
  getLoteDetalle,
  addLote,
  updateLote,
  desactivarLote,
  reactivarLote,
  ajustarStock,
  consumirDesdeLotes,
  getMarcasActivas,
  getMovimientosRecientes,
};
