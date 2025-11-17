// controllers/comprasController.js
const sql = require('mssql');
const poolPromise = require('../db');
const {
  getLotesColumnInfo,
  splitUnitsToCounts,
  computeUnitsFromCounts,
  ensurePositiveNumber,
  parseDecimal,
} = require('../store/inventoryUtils');

let ExcelJS = null;
let hasExcelJs = false;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  ExcelJS = require('exceljs');
  hasExcelJs = true;
} catch (err) {
  console.warn('exceljs no disponible para exportar compras:', err?.message);
}

// Soporte PDF para exportación (además de Excel)
let PDFDocument = null;
let hasPdfKit = false;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  PDFDocument = require('pdfkit');
  hasPdfKit = true;
} catch (err) {
  console.warn('pdfkit no disponible para exportar compras:', err?.message);
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const LISTAR_COMPRAS_BASE_QUERY = `
  SELECT
    oc.OrdenCompraID,
    oc.FechaOrden,
    oc.Total,
    prov.ProveedorID,
    prov.NombreProveedor,
    u.UsuarioID,
    COALESCE(NULLIF(LTRIM(RTRIM(u.Nombres + ' ' + u.Apellidos)), ''), u.Username) AS UsuarioNombre,
    COUNT(dc.DetalleCompraID) AS Items,
    SUM(ISNULL(dc.CantidadEmpaquesRecibidos,0)) AS CantidadEmpaques,
    SUM(ISNULL(dc.CantidadUnidadesMinimasTotales,0)) AS CantidadUnidadesMinimas
  FROM dbo.OrdenCompra oc
  LEFT JOIN dbo.Proveedores prov ON prov.ProveedorID = oc.ProveedorID
  LEFT JOIN dbo.Usuarios u ON u.UsuarioID = oc.UsuarioID
  LEFT JOIN dbo.DetalleCompra dc ON dc.OrdenCompraID = oc.OrdenCompraID
  GROUP BY oc.OrdenCompraID, oc.FechaOrden, oc.Total,
           prov.ProveedorID, prov.NombreProveedor,
           u.UsuarioID, u.Nombres, u.Apellidos, u.Username
  ORDER BY oc.FechaOrden DESC, oc.OrdenCompraID DESC
`;

const dateFormatter = new Intl.DateTimeFormat('es-DO');
const currencyFormatter = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });
const integerFormatter = new Intl.NumberFormat('es-DO');
const DEFAULT_FACTOR_UNIDADES = 1;

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

function formatCurrency(value) {
  return currencyFormatter.format(parseDecimal(value));
}

function formatInteger(value) {
  return integerFormatter.format(ensurePositiveNumber(value));
}

function mapCompraRecord(row) {
  return {
    ordenCompraId: row.OrdenCompraID,
    fechaOrden: row.FechaOrden,
    total: parseDecimal(row.Total),
    proveedor: row.NombreProveedor || null,
    proveedorId: row.ProveedorID || null,
    usuarioId: row.UsuarioID || null,
    usuarioNombre: row.UsuarioNombre || null,
    items: Number(row.Items || 0),
    cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaques),
    cantidadUnidadesMinimas: ensurePositiveNumber(row.CantidadUnidadesMinimas),
  };
}

function createRequest(scope) {
  if (scope instanceof sql.Transaction) return new sql.Request(scope);
  if (scope instanceof sql.Request) return scope;
  if (scope?.request) return scope.request();
  return new sql.Request(scope);
}

async function listarCompras(req, res) {
  try {
    const unsafePage = Number.parseInt(req.query.page, 10);
    const unsafePageSize = Number.parseInt(req.query.pageSize, 10);
    const page = Number.isFinite(unsafePage) && unsafePage > 0 ? unsafePage : 1;
    const pageSizeCandidate =
      Number.isFinite(unsafePageSize) && unsafePageSize > 0 ? unsafePageSize : DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(pageSizeCandidate, MAX_PAGE_SIZE);

    const pool = await poolPromise;

    const totalQuery = await pool.request().query('SELECT COUNT(*) AS Total FROM dbo.OrdenCompra;');
    const total = Number(totalQuery.recordset?.[0]?.Total || 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const offset = Math.max(0, (currentPage - 1) * pageSize);

    const dataQuery = await pool
      .request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`${LISTAR_COMPRAS_BASE_QUERY}
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

    const compras = dataQuery.recordset.map(mapCompraRecord);

    res.json({
      items: compras,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
        hasPrevious: currentPage > 1,
        hasNext: totalPages > 0 && currentPage < totalPages,
      },
      exports: { excel: hasExcelJs, pdf: hasPdfKit },
    });
  } catch (err) {
    console.error('listarCompras error:', err);
    res.status(500).json({ message: 'Error al obtener compras' });
  }
}

async function exportarCompras(req, res) {
  try {
    const formatParam = (req.query.format || 'excel').toString().toLowerCase();
    const format = formatParam === 'xlsx' || formatParam === 'xls' ? 'excel' : formatParam;

    const pool = await poolPromise;
    const query = await pool.request().query(LISTAR_COMPRAS_BASE_QUERY);
    const compras = query.recordset.map(mapCompraRecord);

    if (format === 'excel') {
      if (!hasExcelJs || !ExcelJS) {
        return res
          .status(503)
          .json({ message: 'Exportacion a Excel no disponible. Instale exceljs en el servidor.' });
      }
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Historial de compras');

      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Proveedor', key: 'proveedor', width: 32 },
        { header: 'Usuario', key: 'usuario', width: 24 },
        { header: 'Items', key: 'items', width: 10 },
        { header: 'Empaques', key: 'empaques', width: 12 },
        { header: 'Unidades mínimas', key: 'unidades', width: 18 },
        { header: 'Total (RD$)', key: 'total', width: 14 },
      ];

      worksheet.addRows(
        compras.map((compra) => ({
          fecha: formatDate(compra.fechaOrden) || '-',
          proveedor: compra.proveedor || 'Sin proveedor',
          usuario: compra.usuarioNombre || 'Sin usuario',
          items: compra.items,
          empaques: compra.cantidadEmpaques,
          unidades: compra.cantidadUnidadesMinimas,
          total: parseDecimal(compra.total),
        }))
      );

      worksheet.getColumn('items').numFmt = '#,##0';
      worksheet.getColumn('empaques').numFmt = '#,##0';
      worksheet.getColumn('unidades').numFmt = '#,##0';
      worksheet.getColumn('total').numFmt = '#,##0.00';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename="historial_compras.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
      return;

    if (format === 'pdf') {
      if (!hasPdfKit || !PDFDocument) {
        return res.status(503).json({ message: 'Exportación a PDF no disponible. Instale pdfkit en el servidor.' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="historial_compras.pdf"');

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      doc.pipe(res);

      doc.fontSize(16).text('Historial de compras', { align: 'center' });
      doc.moveDown(1);

      const columns = [
        { key: 'fecha', header: 'Fecha', width: 70, align: 'left' },
        { key: 'proveedor', header: 'Proveedor', width: 160, align: 'left' },
        { key: 'usuario', header: 'Usuario', width: 110, align: 'left' },
        { key: 'items', header: 'Items', width: 50, align: 'right' },
        { key: 'empaques', header: 'Empaques', width: 60, align: 'right' },
        { key: 'total', header: 'Total (RD$)', width: 70, align: 'right' },
      ];

      const startX = doc.page.margins.left;
      let currentY = doc.y;
      const ensureSpace = (height = 18) => {
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (currentY + height > bottom) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }
      };
      const drawRow = (rowValues, isHeader = false) => {
        ensureSpace(isHeader ? 20 : 16);
        let cursorX = startX;
        columns.forEach((column, index) => {
          const text = rowValues[index] ?? '';
          doc
            .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(isHeader ? 11 : 10)
            .text(text, cursorX, currentY, { width: column.width, align: column.align || 'left' });
          cursorX += column.width;
        });
        currentY += isHeader ? 18 : 16;
      };

      // Header
      drawRow(columns.map((c) => c.header), true);
      // Rows
      if (compras.length) {
        compras.forEach((c) => {
          drawRow([
            formatDate(c.fechaOrden) || '-',
            c.proveedor || 'Sin proveedor',
            c.usuarioNombre || 'Sin usuario',
            formatInteger(c.items),
            formatInteger(c.cantidadEmpaques),
            formatCurrency(c.total),
          ]);
        });
      } else {
        doc.font('Helvetica').fontSize(10).text('No hay compras registradas.', startX, currentY);
      }

      doc.end();
      return;
    }

    res.status(400).json({ message: 'Formato de exportación no soportado. Use excel o pdf.' });
      res.setHeader('Content-Type', '');
      res.setHeader('Content-Disposition', 'attachment; filename=""');

      const doc = new ({ size: 'A4', margin: 40 });
      doc.pipe(res);

      doc.fontSize(16).text('Historial de compras', { align: 'center' });
      doc.moveDown(1);

      const columns = [
        { key: 'fecha', header: 'Fecha', width: 70, align: 'left' },
        { key: 'proveedor', header: 'Proveedor', width: 160, align: 'left' },
        { key: 'usuario', header: 'Usuario', width: 110, align: 'left' },
        { key: 'items', header: 'Items', width: 50, align: 'right' },
        { key: 'empaques', header: 'Empaques', width: 60, align: 'right' },
        { key: 'total', header: 'Total (RD$)', width: 70, align: 'right' },
      ];

      const startX = doc.page.margins.left;
      let currentY = doc.y;

      const ensureSpace = (height = 18) => {
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (currentY + height > bottom) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }
      };

      const drawRow = (rowValues, isHeader = false) => {
        ensureSpace(isHeader ? 20 : 16);
        let cursorX = startX;
        columns.forEach((column, index) => {
          const text = rowValues[index] ?? '';
          doc
            .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(isHeader ? 11 : 10)
            .text(text, cursorX, currentY, {
              width: column.width,
              align: column.align || 'left',
            });
          cursorX += column.width;
        });
        currentY += isHeader ? 18 : 16;
      };

      // Header
      drawRow(columns.map((c) => c.header), true);
      // Rows
      if (compras.length) {
        compras.forEach((c) => {
          drawRow([
            formatDate(c.fechaOrden) || '-',
            c.proveedor || 'Sin proveedor',
            c.usuarioNombre || 'Sin usuario',
            formatInteger(c.items),
            formatInteger(c.cantidadEmpaques),
            formatCurrency(c.total),
          ]);
        });
      } else {
        doc.font('Helvetica').fontSize(10).text('No hay compras registradas.', startX, currentY);
      }

      doc.end();
      return;
    }

    res.status(400).json({ message: 'Formato de exportación no soportado. Solo excel.' });
  } catch (err) {
    console.error('exportarCompras error:', err);
    res.status(500).json({ message: 'Error al exportar el historial de compras.' });
  }
}

async function obtenerCompra(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'OrdenCompraID requerido' });

    const pool = await poolPromise;
    const encabezadoQuery = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        SELECT
          oc.OrdenCompraID,
          oc.FechaOrden,
          oc.Total,
          oc.ProveedorID,
          prov.NombreProveedor,
          oc.UsuarioID,
          COALESCE(NULLIF(LTRIM(RTRIM(u.Nombres + ' ' + u.Apellidos)), ''), u.Username) AS UsuarioNombre
        FROM dbo.OrdenCompra oc
        LEFT JOIN dbo.Proveedores prov ON prov.ProveedorID = oc.ProveedorID
        LEFT JOIN dbo.Usuarios u ON u.UsuarioID = oc.UsuarioID
        WHERE oc.OrdenCompraID = @id
      `);

    if (!encabezadoQuery.recordset.length) {
      return res.status(404).json({ message: 'Compra no encontrada' });
    }

    const detalleQuery = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`
        SELECT
          dc.DetalleCompraID,
          dc.ProductoID,
          prod.NombreProducto,
          dc.LoteID,
          l.NumeroLote,
          l.FechaVencimiento,
          l.PrecioCosto,
          l.PrecioUnitarioVenta,
          l.PorcentajeImpuesto,
          l.PorcentajeDescuentoEmpaque,
          dc.PrecioUnitario,
          dc.CantidadEmpaquesRecibidos,
          dc.CantidadUnidadesMinimasTotales,
          l.CantidadUnidadesMinimas AS FactorUnidad
        FROM dbo.DetalleCompra dc
        INNER JOIN dbo.Productos prod ON prod.ProductoID = dc.ProductoID
        LEFT JOIN dbo.Lotes l ON l.LoteID = dc.LoteID
        WHERE dc.OrdenCompraID = @id
        ORDER BY dc.DetalleCompraID
      `);

    const orden = encabezadoQuery.recordset[0];
    const items = detalleQuery.recordset.map((row) => ({
      detalleCompraId: row.DetalleCompraID,
      productoId: row.ProductoID,
      producto: row.NombreProducto,
      loteId: row.LoteID,
      numeroLote: row.NumeroLote,
      fechaVencimiento: row.FechaVencimiento,
      precioCosto: parseDecimal(row.PrecioCosto),
      precioVenta: parseDecimal(row.PrecioUnitarioVenta),
      impuesto: parseDecimal(row.PorcentajeImpuesto, 2),
      descuento: parseDecimal(row.PorcentajeDescuentoEmpaque, 4),
      precioUnitario: parseDecimal(row.PrecioUnitario),
      cantidadEmpaques: ensurePositiveNumber(row.CantidadEmpaquesRecibidos),
      factorUnidad: ensurePositiveNumber(row.FactorUnidad),
      totalUnidades: ensurePositiveNumber(row.CantidadUnidadesMinimasTotales),
      cantidadUnidadesMinimas: ensurePositiveNumber(row.FactorUnidad),
    }));

    res.json({
      ordenCompraId: orden.OrdenCompraID,
      fechaOrden: orden.FechaOrden,
      total: parseDecimal(orden.Total),
      proveedorId: orden.ProveedorID,
      proveedor: orden.NombreProveedor || null,
      usuarioId: orden.UsuarioID,
      usuarioNombre: orden.UsuarioNombre || null,
      items,
    });
  } catch (err) {
    console.error('obtenerCompra error:', err);
    res.status(500).json({ message: 'Error al obtener la compra' });
  }
}

async function crearCompra(req, res) {
  try {
    const { proveedorId, fecha, items } = req.body || {};
    if (!proveedorId) return res.status(400).json({ message: 'Proveedor requerido' });
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Debe agregar al menos un producto' });
    }
    const usuarioId = req.user?.sub ? Number(req.user.sub) : null;
    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();

    const proveedorQuery = await pool
      .request()
      .input('ProveedorID', sql.Int, Number(proveedorId))
      .query(`
        SELECT ProveedorID
        FROM dbo.Proveedores
        WHERE ProveedorID = @ProveedorID
      `);
    if (!proveedorQuery.recordset.length) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    const itemsSanitizados = items.map((raw, index) => ({
      index,
      productoId: Number(raw.productoId ?? raw.ProductoID),
      loteId: raw.loteId ?? raw.LoteID ?? null,
      crearNuevoLote: Boolean(raw.crearNuevoLote ?? raw.nuevoLote ?? (raw.loteId == null && raw.LoteID == null)),
      numeroLote: raw.numeroLote ?? raw.NumeroLote ?? '',
      fechaVencimiento: raw.fechaVencimiento ?? raw.FechaVencimiento ?? null,
      precioCosto: parseDecimal(raw.precioCosto ?? raw.PrecioCosto),
      precioVenta: parseDecimal(raw.precioVenta ?? raw.PrecioVenta),
      impuesto: parseDecimal(raw.impuesto ?? raw.Impuesto, 2),
      descuento: parseDecimal(raw.descuento ?? raw.Descuento, 4),
      cantidadEmpaques: ensurePositiveNumber(raw.cantidadEmpaques ?? raw.CantidadEmpaques ?? 0),
      cantidadUnidadesMinimas: ensurePositiveNumber(
        raw.cantidadUnidadesMinimas ?? raw.CantidadUnidadesMinimas ?? raw.cantidadUnidades ?? 0
      ),
      cantidadTotal: raw.cantidadTotal ?? raw.CantidadTotal ?? raw.CantidadTotalMinima,
    }));

    for (const item of itemsSanitizados) {
      if (!item.productoId) {
        return res.status(400).json({ message: `Producto invalido en item ${item.index + 1}` });
      }
      if (item.crearNuevoLote || !item.loteId) {
        if (!item.numeroLote) {
          return res.status(400).json({ message: `Numero de lote requerido en item ${item.index + 1}` });
        }
        if (!item.fechaVencimiento) {
          return res.status(400).json({ message: `Fecha de vencimiento requerida en item ${item.index + 1}` });
        }
        const fecha = new Date(item.fechaVencimiento);
        if (Number.isNaN(fecha.getTime())) {
          return res.status(400).json({ message: `Fecha de vencimiento invalida en item ${item.index + 1}` });
        }
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fecha < hoy) {
          return res.status(400).json({ message: `Fecha de vencimiento debe ser futura en item ${item.index + 1}` });
        }
        item.fechaVencimientoDate = fecha;
      }
      if (item.precioCosto <= 0) {
        return res.status(400).json({ message: `Precio de costo invalido en item ${item.index + 1}` });
      }
      if (item.precioVenta < item.precioCosto) {
        return res.status(400).json({ message: `Precio de venta menor al costo en item ${item.index + 1}` });
      }
      const totalUnidades =
        meta.hasCantidad && item.cantidadTotal != null
          ? ensurePositiveNumber(item.cantidadTotal)
          : ensurePositiveNumber(item.cantidadEmpaques) + ensurePositiveNumber(item.cantidadUnidadesMinimas);
      if (totalUnidades <= 0) {
        return res.status(400).json({ message: `Cantidad invalida en item ${item.index + 1}` });
      }
    }

    const tx = new sql.Transaction(await poolPromise);
    await tx.begin();
    try {
      const fechaOrden = fecha ? new Date(fecha) : new Date();
      if (Number.isNaN(fechaOrden.getTime())) {
        throw new Error('Fecha de orden invalida');
      }

      const insertarOrden = await new sql.Request(tx)
        .input('ProveedorID', sql.Int, Number(proveedorId))
        .input('UsuarioID', sql.Int, usuarioId)
        .input('FechaOrden', sql.DateTime, fechaOrden)
        .input('Total', sql.Decimal(12, 2), 0)
        .query(`
          INSERT INTO dbo.OrdenCompra (ProveedorID, UsuarioID, FechaOrden, Total)
          OUTPUT INSERTED.OrdenCompraID
          VALUES (@ProveedorID, @UsuarioID, @FechaOrden, @Total);
        `);

      const ordenCompraId = insertarOrden.recordset[0]?.OrdenCompraID;
      if (!ordenCompraId) throw new Error('No se pudo crear la orden de compra');

      let totalOrden = 0;

      for (const item of itemsSanitizados) {
        const productoQuery = await new sql.Request(tx)
          .input('ProductoID', sql.Int, item.productoId)
          .query(`
            SELECT ProductoID, Activo
            FROM dbo.Productos
            WHERE ProductoID = @ProductoID
          `);
        if (!productoQuery.recordset.length) {
          throw new Error(`Producto no encontrado (item ${item.index + 1})`);
        }
        const producto = productoQuery.recordset[0];
        if (!producto.Activo) {
          throw new Error(`Producto inactivo (item ${item.index + 1})`);
        }
        const cantidadEmpaques = Math.round(ensurePositiveNumber(item.cantidadEmpaques));
        const factorEntrada = meta.hasCantidadUnidades
          ? ensurePositiveNumber(item.cantidadUnidadesMinimas)
          : DEFAULT_FACTOR_UNIDADES;
        if (meta.hasCantidadUnidades && factorEntrada <= 0) {
          throw new Error(`Unidades por empaque inválidas (item ${item.index + 1})`);
        }
        let factor = factorEntrada || DEFAULT_FACTOR_UNIDADES;
        let totalUnidades;

        if (meta.hasCantidad && item.cantidadTotal != null) {
          totalUnidades = Math.round(ensurePositiveNumber(item.cantidadTotal));
        } else {
          totalUnidades = Math.round(cantidadEmpaques * factor);
        }

        if (totalUnidades <= 0) {
          throw new Error(`Cantidad total invalida (item ${item.index + 1})`);
        }

        let loteIdAsignado = Number(item.loteId) || null;
        if (!loteIdAsignado || item.crearNuevoLote) {
          const insertColumns = [
            'ProductoID',
            'NumeroLote',
            'FechaVencimiento',
            'FechaIngreso',
            'Activo',
            'PrecioCosto',
            'PrecioUnitarioVenta',
            'PorcentajeImpuesto',
            'PorcentajeDescuentoEmpaque',
          ];
          const insertValues = [
            '@ProductoID',
            '@NumeroLote',
            '@FechaVencimiento',
            'GETDATE()',
            '1',
            '@PrecioCosto',
            '@PrecioVenta',
            '@Impuesto',
            '@Descuento',
          ];
          const counts = splitUnitsToCounts(totalUnidades, factor, meta);
          const reqLote = new sql.Request(tx)
            .input('ProductoID', sql.Int, item.productoId)
            .input('NumeroLote', sql.NVarChar(100), String(item.numeroLote))
            .input('FechaVencimiento', sql.Date, item.fechaVencimientoDate || new Date(item.fechaVencimiento))
            .input('PrecioCosto', sql.Decimal(10, 2), item.precioCosto)
            .input('PrecioVenta', sql.Decimal(10, 2), item.precioVenta)
            .input('Impuesto', sql.Decimal(5, 2), item.impuesto)
            .input('Descuento', sql.Decimal(5, 4), item.descuento);
          if (meta.hasCantidadEmpaques) {
            insertColumns.push('CantidadEmpaques');
            insertValues.push('@CantidadEmpaques');
            reqLote.input('CantidadEmpaques', sql.Int, Math.round(counts.empaques ?? cantidadEmpaques));
          }
          if (meta.hasCantidadUnidades) {
            insertColumns.push('CantidadUnidadesMinimas');
            insertValues.push('@CantidadUnidadesMinimas');
            reqLote.input('CantidadUnidadesMinimas', sql.Int, Math.round(factor));
          }
          if (meta.hasCantidad) {
            insertColumns.push('Cantidad');
            insertValues.push('@CantidadTotal');
            reqLote.input('CantidadTotal', sql.Int, Math.round(counts.cantidad ?? totalUnidades));
          }
          const insertLote = await reqLote.query(`
            INSERT INTO dbo.Lotes (${insertColumns.join(', ')})
            OUTPUT INSERTED.LoteID
            VALUES (${insertValues.join(', ')});
          `);
          loteIdAsignado = insertLote.recordset[0]?.LoteID;
        } else {
          const loteQuery = await new sql.Request(tx)
            .input('LoteID', sql.Int, loteIdAsignado)
            .query(`
              SELECT LoteID, ProductoID,
                     ${meta.hasCantidadEmpaques ? 'COALESCE(CantidadEmpaques,0) AS CantidadEmpaques,' : '0 AS CantidadEmpaques,'}
                     ${meta.hasCantidadUnidades ? 'COALESCE(CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,' : '0 AS CantidadUnidadesMinimas,'}
                     ${meta.hasCantidad ? 'COALESCE(Cantidad,0) AS Cantidad,' : '0 AS Cantidad,'}
                     PrecioCosto, PrecioUnitarioVenta, PorcentajeImpuesto, PorcentajeDescuentoEmpaque, FechaVencimiento
              FROM dbo.Lotes
              WHERE LoteID = @LoteID
            `);
          if (!loteQuery.recordset.length) {
            throw new Error(`Lote no encontrado (item ${item.index + 1})`);
          }
          const loteActual = loteQuery.recordset[0];
          if (Number(loteActual.ProductoID) !== item.productoId) {
            throw new Error(`El lote indicado no pertenece al producto (item ${item.index + 1})`);
          }
          if (
            (parseDecimal(loteActual.PrecioCosto) !== item.precioCosto ||
              parseDecimal(loteActual.PrecioUnitarioVenta) !== item.precioVenta ||
              parseDecimal(loteActual.PorcentajeImpuesto, 2) !== item.impuesto ||
              parseDecimal(loteActual.PorcentajeDescuentoEmpaque, 4) !== item.descuento) &&
            !item.crearNuevoLote
          ) {
            throw new Error(`El lote tiene precios diferentes; marque "crear nuevo lote" (item ${item.index + 1})`);
          }
          const factorLote = ensurePositiveNumber(loteActual.CantidadUnidadesMinimas, 0);
          if (factorLote > 0 && Math.round(factorLote) !== Math.round(factor)) {
            throw new Error(`Las unidades por empaque no coinciden con el lote (item ${item.index + 1})`);
          }
          const factorEfectivo = factorLote > 0 ? factorLote : factor;
          const unidadesActuales = computeUnitsFromCounts(
            {
              empaques: loteActual.CantidadEmpaques,
              unidades: loteActual.CantidadUnidadesMinimas,
              cantidad: loteActual.Cantidad,
            },
            factorEfectivo,
            meta
          );
          const unidadesActualizadas = unidadesActuales + totalUnidades;
          const nuevos = splitUnitsToCounts(unidadesActualizadas, factorEfectivo, meta);
          const updateParts = [
            'PrecioCosto = @PrecioCosto',
            'PrecioUnitarioVenta = @PrecioVenta',
            'PorcentajeImpuesto = @Impuesto',
            'PorcentajeDescuentoEmpaque = @Descuento',
          ];
          const reqUpdate = new sql.Request(tx)
            .input('LoteID', sql.Int, loteIdAsignado)
            .input('PrecioCosto', sql.Decimal(10, 2), item.precioCosto)
            .input('PrecioVenta', sql.Decimal(10, 2), item.precioVenta)
            .input('Impuesto', sql.Decimal(5, 2), item.impuesto)
            .input('Descuento', sql.Decimal(5, 4), item.descuento);
          if (meta.hasCantidadEmpaques) {
            updateParts.push('CantidadEmpaques = @CantidadEmpaques');
            reqUpdate.input('CantidadEmpaques', sql.Int, Math.round(nuevos.empaques ?? 0));
          }
          if (meta.hasCantidadUnidades) {
            updateParts.push('CantidadUnidadesMinimas = @CantidadUnidadesMinimas');
            reqUpdate.input('CantidadUnidadesMinimas', sql.Int, Math.round(nuevos.unidades ?? factorEfectivo));
          }
          if (meta.hasCantidad) {
            updateParts.push('Cantidad = @CantidadTotal');
            reqUpdate.input('CantidadTotal', sql.Int, Math.round(nuevos.cantidad ?? unidadesActualizadas));
          }
          if (item.fechaVencimientoDate || item.fechaVencimiento) {
            updateParts.push('FechaVencimiento = @FechaVencimiento');
            reqUpdate.input(
              'FechaVencimiento',
              sql.Date,
              item.fechaVencimientoDate || new Date(item.fechaVencimiento)
            );
          }
          await reqUpdate.query(`UPDATE dbo.Lotes SET ${updateParts.join(', ')} WHERE LoteID = @LoteID;`);
        }

        await new sql.Request(tx)
          .input('OrdenCompraID', sql.Int, ordenCompraId)
          .input('ProductoID', sql.Int, item.productoId)
          .input('LoteID', sql.Int, loteIdAsignado)
          .input('PrecioUnitario', sql.Decimal(10, 2), item.precioCosto)
          .input('CantidadEmpaquesRecibidos', sql.Int, Math.round(item.cantidadEmpaques))
          .input('CantidadUnidadesMinimasTotales', sql.Int, Math.round(totalUnidades))
          .query(`
            INSERT INTO dbo.DetalleCompra
              (OrdenCompraID, ProductoID, LoteID, PrecioUnitario, CantidadEmpaquesRecibidos, CantidadUnidadesMinimasTotales)
            VALUES (@OrdenCompraID, @ProductoID, @LoteID, @PrecioUnitario, @CantidadEmpaquesRecibidos, @CantidadUnidadesMinimasTotales);
          `);

        await new sql.Request(tx)
          .input('ProductoID', sql.Int, item.productoId)
          .input('Cantidad', sql.Int, Math.round(totalUnidades))
          .query(`
            UPDATE dbo.Productos
            SET StockActual = COALESCE(StockActual,0) + @Cantidad,
                FechaModificacion = GETDATE()
            WHERE ProductoID = @ProductoID;
          `);

        const costoPorEmpaque = parseDecimal(item.precioCosto);
        const base = costoPorEmpaque * cantidadEmpaques;
        totalOrden += base;
      }

      await new sql.Request(tx)
        .input('OrdenCompraID', sql.Int, ordenCompraId)
        .input('Total', sql.Decimal(12, 2), parseDecimal(totalOrden))
        .query(`
          UPDATE dbo.OrdenCompra
          SET Total = @Total
          WHERE OrdenCompraID = @OrdenCompraID;
        `);

      await tx.commit();
      res.status(201).json({
        message: 'Compra registrada',
        ordenCompraId,
        total: parseDecimal(totalOrden),
      });
    } catch (errTx) {
      await tx.rollback();
      throw errTx;
    }
  } catch (err) {
    console.error('crearCompra error:', err);
    res.status(500).json({ message: err.message || 'Error al registrar la compra' });
  }
}

module.exports = {
  listarCompras,
  exportarCompras,
  obtenerCompra,
  crearCompra,
};


