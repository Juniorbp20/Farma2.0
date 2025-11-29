// controllers/ventasController.js
const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const poolPromise = require("../db");
const invUtilsPath = require("path").join(
  __dirname,
  "..",
  "store",
  "inventoryUtils"
);
const {
  getLotesColumnInfo,
  getCantidadExpressions,
  ensurePositiveNumber,
  parseDecimal,
  splitUnitsToCounts,
} = require(invUtilsPath);

let PDFDocument = null;
try {
  PDFDocument = require("pdfkit");
} catch {}

const FACTURAS_DIR = path.join(
  process.cwd(),
  "recursos_sistema",
  "facturas_fmanager"
);
const DEFAULT_FACTOR_UNIDADES = 1;

async function historialDia(req, res) {
  try {
    const pool = await poolPromise;
    const fechaTexto = req.query.fecha;
    const fechaBase = fechaTexto
      ? new Date(`${fechaTexto}T00:00:00`)
      : new Date();
    const fechaParam = Number.isNaN(fechaBase.getTime())
      ? new Date()
      : fechaBase;
    if (Number.isNaN(fechaParam.getTime())) {
      return res.status(400).json({ message: "Fecha invalida" });
    }
    const desde = new Date(fechaParam);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(fechaParam);
    hasta.setHours(23, 59, 59, 999);

    const ventasQ = await pool
      .request()
      .input("from", sql.DateTime, desde)
      .input("to", sql.DateTime, hasta).query(`
        SELECT v.VentaID, v.FechaVenta, v.Total, v.ClienteID, v.FormaPago, v.UsuarioID,
               COALESCE(u.Username, '') AS UsuarioNombre,
               LTRIM(RTRIM(COALESCE(c.Nombres,'') + ' ' + COALESCE(c.Apellidos,''))) AS ClienteNombre,
               v.Estado
        FROM dbo.Ventas v
        LEFT JOIN dbo.Usuarios u ON u.UsuarioID = v.UsuarioID
        LEFT JOIN dbo.Clientes c ON c.ClienteID = v.ClienteID
        WHERE v.FechaVenta BETWEEN @from AND @to
        ORDER BY v.FechaVenta DESC, v.VentaID DESC
      `);

    const metodos = {};
    let totalVentas = 0;
    ventasQ.recordset.forEach((v) => {
      const total = Number(v.Total || 0);
      totalVentas += total;
      const key = v.FormaPago || "Otro";
      metodos[key] = (metodos[key] || 0) + total;
    });

    const metodosPago = Object.entries(metodos).map(([metodo, total]) => ({
      metodo,
      total,
    }));
    const ventas = ventasQ.recordset.map((v) => ({
      numeroFactura: v.VentaID,
      hora: v.FechaVenta ? new Date(v.FechaVenta).toLocaleTimeString() : "",
      cliente: v.ClienteNombre || v.ClienteID || "-",
      total: Number(v.Total || 0),
      metodoPago: v.FormaPago || "-",
      usuario: v.UsuarioNombre || v.UsuarioID || "-",
      estado: v.Estado || "-",
    }));

    const devQ = await pool
      .request()
      .input("from", sql.DateTime, desde)
      .input("to", sql.DateTime, hasta).query(`
        SELECT SUM(ISNULL(dd.CantidadUnidadesMinimasDevueltas,0) * ISNULL(dd.PrecioUnitario,0)) AS TotalDev
        FROM dbo.Devoluciones d
        INNER JOIN dbo.DetalleDevolucion dd ON dd.DevolucionID = d.DevolucionID
        WHERE d.FechaDevolucion BETWEEN @from AND @to
      `);
    const totalDevoluciones = Number(devQ.recordset?.[0]?.TotalDev || 0);

    return res.json({
      fecha: desde.toISOString().slice(0, 10),
      totalVentas,
      cantidadVentas: ventas.length,
      totalDevoluciones,
      metodosPago,
      ventas,
    });
  } catch (err) {
    console.error("historialDia error:", err);
    return res
      .status(500)
      .json({ message: "Error al obtener historial del dia" });
  }
}

function createRequest(scope) {
  if (scope instanceof sql.Transaction) return new sql.Request(scope);
  if (scope instanceof sql.Request) return scope;
  if (scope?.request) return scope.request();
  return new sql.Request(scope);
}

async function ensureHistorialTable(pool) {
  await pool.request().query(`
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

async function getProductoFactor() {
  return DEFAULT_FACTOR_UNIDADES;
}

async function consumirDeLote(scope, loteId, unidades) {
  const meta = await getLotesColumnInfo();
  const { factorExpr } = getCantidadExpressions(meta, { alias: "l" });
  const reqL = createRequest(scope).input("LoteID", sql.Int, Number(loteId));
  const selectQuery = `
    SELECT l.LoteID, l.ProductoID, COALESCE(l.Activo,1) AS Activo,
           ${meta.hasCantidad ? "COALESCE(l.Cantidad,0)" : "0"} AS Cantidad,
           ${
             meta.hasCantidadEmpaques ? "COALESCE(l.CantidadEmpaques,0)" : "0"
           } AS CantidadEmpaques,
           ${
             meta.hasCantidadUnidades
               ? "COALESCE(l.CantidadUnidadesMinimas,0)"
               : "0"
           } AS CantidadUnidadesMinimas,
           ${
             meta.hasTotalUnidades ? "COALESCE(l.TotalUnidadesMinimas,0)" : "0"
           } AS TotalUnidadesMinimas,
           ${factorExpr} AS Factor
    FROM dbo.Lotes l
    WHERE l.LoteID = @LoteID`;
  const loteQ = await reqL.query(selectQuery);
  if (!loteQ.recordset.length) throw new Error("Lote no encontrado");
  const row = loteQ.recordset[0];
  if (!row.Activo) throw new Error("Lote inactivo");
  const factorUnidades =
    ensurePositiveNumber(row.CantidadUnidadesMinimas || row.Factor, 1) || 1;
  const totalActual = meta.hasTotalUnidades
    ? ensurePositiveNumber(row.TotalUnidadesMinimas) ||
      ensurePositiveNumber(row.CantidadEmpaques) * factorUnidades
    : ensurePositiveNumber(row.CantidadEmpaques) * factorUnidades;
  const tomar = Math.max(
    0,
    Math.min(ensurePositiveNumber(unidades), totalActual)
  );
  if (tomar < ensurePositiveNumber(unidades)) {
    throw Object.assign(
      new Error(
        `Stock insuficiente en el lote ${loteId} (disp: ${totalActual}, solicitado: ${unidades}).`
      ),
      { status: 409 }
    );
  }
  const restante = totalActual - tomar;
  const nv = splitUnitsToCounts(restante, factorUnidades, meta);
  const parts = [];
  const reqUp = createRequest(scope).input("LoteID", sql.Int, Number(loteId));
  if (meta.hasCantidadEmpaques) {
    parts.push("CantidadEmpaques = @CantidadEmpaques");
    reqUp.input(
      "CantidadEmpaques",
      sql.Int,
      Math.max(0, Math.floor(nv.empaques ?? 0))
    );
  }
  if (meta.hasTotalUnidades) {
    parts.push("TotalUnidadesMinimas = @TotalUnidades");
    reqUp.input(
      "TotalUnidades",
      sql.Int,
      Math.round(nv.totalUnidades ?? restante)
    );
  }
  if (parts.length)
    await reqUp.query(
      `UPDATE dbo.Lotes SET ${parts.join(", ")} WHERE LoteID = @LoteID;`
    );
  await createRequest(scope)
    .input("ProductoID", sql.Int, Number(row.ProductoID))
    .input("Cantidad", sql.Int, Math.round(tomar))
    .query(
      `UPDATE dbo.Productos SET StockActual = CASE WHEN StockActual IS NULL THEN 0 WHEN StockActual <= @Cantidad THEN 0 ELSE StockActual - @Cantidad END, FechaModificacion = GETDATE() WHERE ProductoID = @ProductoID;`
    );
  return { productoId: row.ProductoID, consumido: tomar };
}

function calcLinea(item, factor, loteData) {
  const modo =
    String(item.modo || "").toLowerCase() === "empaque" ? "empaque" : "detalle";
  const cantEmp = ensurePositiveNumber(item.cantEmpaques);
  const cantUni = ensurePositiveNumber(item.cantUnidadesMinimas);
  const unidades = modo === "empaque" ? cantEmp * factor : cantUni;
  const precioEmpaque = parseDecimal(
    loteData?.PrecioUnitarioVenta ?? item.precioUnitarioVenta
  );
  const precioUnidadMin = factor > 0 ? precioEmpaque / factor : precioEmpaque;
  const rawDesc = parseDecimal(
    loteData?.PorcentajeDescuentoEmpaque ?? item.porcentajeDescEmpaque,
    4
  );
  const descEmpaquePct = rawDesc > 1 ? rawDesc / 100 : rawDesc;
  const descEmpaque =
    modo === "empaque" ? Math.min(1, Math.max(0, descEmpaquePct)) : 0;
  const impuestoRaw = parseDecimal(
    loteData?.ImpuestoProducto ??
      loteData?.PorcentajeImpuesto ??
      item.porcentajeImpuesto,
    4
  );
  const impuestoPct = impuestoRaw > 1 ? impuestoRaw : impuestoRaw;
  let precioAplicadoUnidad = precioUnidadMin;
  if (modo === "empaque" && factor > 0) {
    const conDesc = precioEmpaque * (1 - descEmpaque);
    precioAplicadoUnidad = conDesc / factor;
  }
  const subtotalLinea = parseDecimal(unidades * precioAplicadoUnidad);
  const impuestoLinea = parseDecimal(subtotalLinea * (impuestoPct / 100), 2);
  const totalLinea = parseDecimal(subtotalLinea + impuestoLinea, 2);
  return {
    unidades,
    precioAplicadoUnidad,
    subtotalLinea,
    impuestoLinea,
    totalLinea,
    modo,
  };
}

const crearVenta = async (req, res) => {
  const httpError = (status, message) =>
    Object.assign(new Error(message), { status });
  try {
    const {
      usuarioId,
      clienteId = null,
      formaPago = "Efectivo",
      estado = "Pagada",
      observaciones = "",
      descuentoGlobal = null,
      pago: pagoReq = null,
      items = [],
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "No se puede crear una venta vacia." });
    }
    if (String(estado).toLowerCase() === "credito" && clienteId == null) {
      return res
        .status(400)
        .json({ message: "Para ventas a credito se requiere Cliente." });
    }

    const pool = await poolPromise;
    const metaLotes = await getLotesColumnInfo();
    const { factorExpr, totalExpr } = getCantidadExpressions(metaLotes, {
      alias: "l",
    });
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      const now = new Date();
      const fechaIso = now.toISOString();

      const lineas = [];
      const consumoPorLote = new Map();
      let subtotal = 0;
      let impuestoTotal = 0;

      for (const it of items) {
        const productoId = Number(it.productoId || it.ProductoID);
        const loteId = Number(it.loteId || it.LoteID);
        if (!productoId || !loteId)
          throw new Error("Cada item requiere productoId y loteId");
        const lotQ = await createRequest(tx).input("LoteID", sql.Int, loteId)
          .query(`
            SELECT l.PrecioUnitarioVenta,
                   l.PorcentajeDescuentoEmpaque,
                   l.NumeroLote,
                   ${
                     metaLotes.hasCantidad
                       ? "COALESCE(l.Cantidad,0) AS Cantidad,"
                       : ""
                   }
                   ${
                     metaLotes.hasCantidadEmpaques
                       ? "COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,"
                       : ""
                   }
                   ${
                     metaLotes.hasCantidadUnidades
                       ? "COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,"
                       : ""
                   }
                   ${
                     metaLotes.hasTotalUnidades
                       ? "COALESCE(l.TotalUnidadesMinimas,0) AS TotalUnidadesMinimas,"
                       : ""
                   }
                   p.NombreProducto, p.Presentacion, COALESCE(p.Impuesto,0) AS ImpuestoProducto,
                   ${factorExpr} AS FactorUnidades,
                   ${totalExpr} AS TotalUnidadesDisponibles
            FROM dbo.Lotes l
            INNER JOIN dbo.Productos p ON p.ProductoID = l.ProductoID
            WHERE l.LoteID = @LoteID`);
        const loteData = lotQ.recordset[0] || {};
        const factor = ensurePositiveNumber(loteData?.FactorUnidades, 1) || 1;
        const unidadesDisponibles = metaLotes.hasTotalUnidades
          ? ensurePositiveNumber(loteData?.TotalUnidadesMinimas, 0)
          : metaLotes.hasCantidad
          ? ensurePositiveNumber(loteData?.Cantidad, 0)
          : ensurePositiveNumber(loteData?.CantidadEmpaques, 0) * factor;
        const calc = calcLinea(it, factor, loteData);
        if (calc.unidades > unidadesDisponibles) {
          throw httpError(
            409,
            `Stock insuficiente en el lote seleccionado (disp: ${unidadesDisponibles}, solicitado: ${calc.unidades}).`
          );
        }
        subtotal += calc.subtotalLinea;
        impuestoTotal += calc.impuestoLinea;
        const keyLote = String(loteId);
        consumoPorLote.set(
          keyLote,
          (consumoPorLote.get(keyLote) || 0) + calc.unidades
        );
        lineas.push({
          productoId,
          loteId,
          modo: calc.modo,
          cantEmpaques: ensurePositiveNumber(it.cantEmpaques),
          cantUnidadesMinimas: ensurePositiveNumber(it.cantUnidadesMinimas),
          unidades: calc.unidades,
          factor,
          precioUnitarioVenta: parseDecimal(
            loteData?.PrecioUnitarioVenta ?? it.precioUnitarioVenta
          ),
          porcentajeImpuesto: parseDecimal(
            loteData?.PorcentajeImpuesto ?? it.porcentajeImpuesto,
            4
          ),
          porcentajeDescEmpaque: parseDecimal(
            loteData?.PorcentajeDescuentoEmpaque ?? it.porcentajeDescEmpaque,
            4
          ),
          subtotal: calc.subtotalLinea,
          impuesto: calc.impuestoLinea,
          total: calc.totalLinea,
          numeroLote: loteData?.NumeroLote || null,
          productoNombre: loteData?.NombreProducto || null,
          productoPresentacion: loteData?.Presentacion || null,
        });
      }

      let descuentoMonto = 0;
      if (
        descuentoGlobal &&
        descuentoGlobal.tipo &&
        descuentoGlobal.valor != null
      ) {
        const tipo = String(descuentoGlobal.tipo);
        const valor = Number(descuentoGlobal.valor);
        if (tipo === "%") {
          if (valor < 0 || valor > 100)
            throw new Error("Descuento % fuera de rango 0-100");
          descuentoMonto = parseDecimal(subtotal * (valor / 100));
        } else {
          descuentoMonto = Math.max(0, Math.min(parseDecimal(valor), subtotal));
        }
      }

      const total = parseDecimal(
        Math.max(0, subtotal - descuentoMonto + impuestoTotal)
      );

      for (const [key, unidadesSolic] of consumoPorLote.entries()) {
        const lid = Number(key);
        const loteInfo = await createRequest(tx).input("lid", sql.Int, lid)
          .query(`
            SELECT ${factorExpr} AS Factor,
                   ${totalExpr} AS TotalUnidadesDisponibles
            FROM dbo.Lotes l WHERE l.LoteID = @lid
          `);
        const disp = ensurePositiveNumber(
          loteInfo.recordset?.[0]?.TotalUnidadesDisponibles
        );
        if (ensurePositiveNumber(unidadesSolic) > disp) {
          throw httpError(
            409,
            `Stock insuficiente en el lote seleccionado (disp: ${disp}, solicitado: ${unidadesSolic}).`
          );
        }
      }

      const reqVenta = createRequest(tx)
        .input(
          "UsuarioID",
          sql.Int,
          usuarioId || (req.user?.sub ? Number(req.user.sub) : null)
        )
        .input(
          "ClienteID",
          sql.Int,
          clienteId == null ? null : Number(clienteId)
        )
        .input("Estado", sql.NVarChar(20), estado)
        .input("FormaPago", sql.NVarChar(20), formaPago)
        .input("Observaciones", sql.NVarChar(400), observaciones || "")
        .input("Subtotal", sql.Decimal(18, 2), parseDecimal(subtotal))
        .input(
          "DescuentoTotal",
          sql.Decimal(18, 2),
          parseDecimal(descuentoMonto)
        )
        .input("ImpuestoTotal", sql.Decimal(18, 2), parseDecimal(impuestoTotal))
        .input("Total", sql.Decimal(18, 2), parseDecimal(total));
      const ventaInsert = await reqVenta.query(`
        INSERT INTO dbo.Ventas(FechaVenta, Total, UsuarioID, ClienteID, Estado, FormaPago, Observaciones, Subtotal, DescuentoTotal, ImpuestoTotal)
        OUTPUT INSERTED.VentaID
        VALUES (GETDATE(), @Total, @UsuarioID, @ClienteID, @Estado, @FormaPago, @Observaciones, @Subtotal, @DescuentoTotal, @ImpuestoTotal);
      `);
      const ventaIdDb = ventaInsert.recordset?.[0]?.VentaID;

      for (const ln of lineas) {
        const reqDet = createRequest(tx)
          .input("VentaID", sql.Int, ventaIdDb)
          .input("ProductoID", sql.Int, ln.productoId)
          .input("LoteID", sql.Int, ln.loteId)
          .input(
            "PrecioUnitario",
            sql.Decimal(18, 2),
            parseDecimal(ln.precioAplicadoUnidad ?? ln.precioUnitarioVenta)
          )
          .input(
            "CantEmp",
            sql.Int,
            ln.modo === "empaque"
              ? Math.round(ensurePositiveNumber(ln.cantEmpaques))
              : 0
          )
          .input(
            "CantUni",
            sql.Int,
            ln.modo === "detalle"
              ? Math.round(ensurePositiveNumber(ln.cantUnidadesMinimas))
              : 0
          );
        await reqDet.query(`
          INSERT INTO dbo.DetalleVenta(VentaID, ProductoID, LoteID, PrecioUnitario, CantidadEmpaquesVendidos, CantidadUnidadesMinimasVendidas)
          VALUES (@VentaID, @ProductoID, @LoteID, @PrecioUnitario, @CantEmp, @CantUni);
        `);
      }

      for (const ln of lineas) {
        if (ln.unidades <= 0) continue;
        const consumo = await consumirDeLote(tx, ln.loteId, ln.unidades);
        try {
          const uid =
            usuarioId || (req.user?.sub ? Number(req.user.sub) : null);
          await createRequest(tx)
            .input("LoteID", sql.Int, ln.loteId)
            .input("UsuarioID", sql.Int, uid)
            .input(
              "Detalle",
              sql.NVarChar(4000),
              `VentaID: ${ventaIdDb || ""}, ProductoID: ${
                ln.productoId
              }, Unidades: ${Math.round(consumo?.consumido ?? ln.unidades)}`
            )
            .query(`INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle, Fecha, Motivo)
                    VALUES (@LoteID, @UsuarioID, 'Venta', @Detalle, GETDATE(), NULL);`);
        } catch (err) {
          console.warn(
            "No se pudo registrar historial de inventario:",
            err?.message
          );
        }
      }

      await tx.commit();

      const pago =
        pagoReq && typeof pagoReq === "object"
          ? {
              metodo: pagoReq.metodo || formaPago,
              monto: Number(pagoReq.monto || 0),
            }
          : { metodo: formaPago, monto: 0 };
      const cambio =
        pago.metodo && pago.metodo.toLowerCase() === "efectivo"
          ? Math.max(0, parseDecimal(Number(pago.monto || 0) - total))
          : 0;

      let paramsSistema = {};
      try {
        paramsSistema =
          await require("../services/configService").getParametrosSistema();
      } catch {}

      let clienteInfo = null;
      if (clienteId != null) {
        try {
          const cliQ = await createRequest(pool).input(
            "cid",
            sql.Int,
            Number(clienteId)
          ).query(`SELECT TOP 1 c.Nombres, c.Apellidos, c.Documento,
                           COALESCE(td.Nombre,'') AS TipoDocumentoNombre
                    FROM dbo.Clientes c
                    LEFT JOIN dbo.TiposDocumentos td ON td.TipoDocumentoID = c.TipoDocumentoID
                    WHERE c.ClienteID = @cid`);
          clienteInfo = cliQ.recordset[0] || null;
        } catch {}
      }

      const payload = {
        ventaId: ventaIdDb || null,
        fecha: fechaIso,
        usuarioId: usuarioId || (req.user?.sub ? Number(req.user.sub) : null),
        clienteId: clienteId == null ? null : Number(clienteId),
        formaPago,
        pago: { ...pago, cambio },
        estado,
        observaciones,
        descuento: parseDecimal(descuentoMonto),
        subtotal: parseDecimal(subtotal),
        impuestoTotal: parseDecimal(impuestoTotal),
        total,
        items: lineas,
      };

      const currency =
        paramsSistema?.monedaSimbolo || process.env.CURRENCY || "RD$";
      const empresaNombre =
        paramsSistema?.nombreEmpresa || process.env.BUSINESS_NAME || "Fmanager";
      const empresaDir =
        paramsSistema?.direccion || process.env.BUSINESS_ADDRESS || "";
      const empresaRuc =
        paramsSistema?.rucNit || process.env.BUSINESS_RNC || "";
      const nota1 = "##NO DEVOLUCION DE DINERO##";
      const nota2 = "##NO DEVOLUCION DESPUES DE 1 DIA##";
      const nota3 = "Conserve su factura para cualquier reclamacion.";

      if (!fs.existsSync(FACTURAS_DIR))
        fs.mkdirSync(FACTURAS_DIR, { recursive: true });
      const ts = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const pdfPath = path.join(
        FACTURAS_DIR,
        `factura_${payload.ventaId}_${ts}.pdf`
      );
      try {
        if (PDFDocument) {
          await new Promise((resolve, reject) => {
            const width = 390; // formato ancho (~112 mm)
            const baseHeight = 360; // mas espacio para cabecera/totales
            const itemsHeight = Math.max(160, payload.items.length * 36);
            const height = baseHeight + itemsHeight;
            const doc = new PDFDocument({ size: [width, height], margin: 12 });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);

            doc
              .fontSize(12)
              .text(`*** ${empresaNombre} ***`, { align: "center" });
            if (empresaDir) doc.text(empresaDir, { align: "center" });
            if (empresaRuc) doc.text(`RNC: ${empresaRuc}`, { align: "center" });
            doc.moveDown(1);

            const createdAt = new Date(payload.fecha);
            doc.text(`FACTURA #: ${payload.ventaId}`);
            doc.text(`Fecha y Hora: ${createdAt.toLocaleString()}`);
            const cliLabel = clienteInfo
              ? `${(clienteInfo.Nombres || "").trim()} ${(
                  clienteInfo.Apellidos || ""
                ).trim()}`.trim()
              : "Consumidor Final";
            const cliDoc = clienteInfo?.Documento
              ? `${clienteInfo.TipoDocumentoNombre || "Doc"}: ${
                  clienteInfo.Documento
                }`
              : "";
            doc.text(`Cliente: ${cliLabel}${cliDoc ? ` (${cliDoc})` : ""}`);
            doc.text(`Forma de pago: ${payload.formaPago || formaPago}`);
            doc.moveDown(0.5);

            // Encabezado de items (formato columnas)
            doc.font("Courier").fontSize(10);
            const colDesc = 30; // Descripcion (ancho base)
            const colItbis = 13; // ITBIS
            const colMonto = 13; // Monto

            const sep = "-".repeat(colDesc + colItbis + colMonto + 6);
            const pad = (s, w) => {
              const str = String(s ?? "");
              if (str.length >= w) return str.slice(0, w);
              return str + " ".repeat(w - str.length);
            };
            const lpad = (s, w) => {
              const str = String(s ?? "");
              if (str.length >= w) return str.slice(0, w);
              return " ".repeat(w - str.length) + str;
            };

            doc.text(
              pad("Descripcion", colDesc) +
                "   " +
                lpad("ITBIS", colItbis) +
                "  " +
                lpad("Monto", colMonto)
            );
            doc.text(sep);

            // helper: envolver desc; si supera el ancho, en siguientes lineas reduce 1 y baja a la izquierda
            const wrapWords = (text, firstWidth, nextWidth) => {
              const words = String(text || "")
                .split(/\s+/)
                .filter(Boolean);
              const lines = [];
              let width = firstWidth;
              let current = "";
              for (const w of words) {
                if ((current ? current.length + 1 : 0) + w.length <= width) {
                  current = current ? current + " " + w : w;
                } else {
                  if (current) lines.push(current);
                  current = w;
                  width = nextWidth; // para siguientes lineas usamos ancho reducido
                }
              }
              if (current) lines.push(current);
              return lines;
            };

            payload.items.forEach((ln) => {
              const qty =
                ln.modo === "detalle"
                  ? ln.cantUnidadesMinimas || 0
                  : ln.cantEmpaques || 0;
              const qtyLabel =
                ln.modo === "detalle" ? "unidad(es)" : "empaque(s)";
              const itbisLinea = parseDecimal(ln.impuesto, 2);
              const lineTotal = parseDecimal(ln.total, 2);
              const desc = `${
                ln.productoNombre || "Producto " + ln.productoId
              }${ln.productoPresentacion ? " " + ln.productoPresentacion : ""}`;

              const descLines = wrapWords(
                desc,
                colDesc,
                Math.max(1, colDesc - 1)
              );
              const firstRow =
                pad(descLines[0] || "", colDesc) +
                " " +
                lpad(`${currency} ${itbisLinea.toFixed(2)}`, colItbis) +
                "  " +
                lpad(`${currency} ${lineTotal.toFixed(2)}`, colMonto);
              doc.text(firstRow);

              const qtyRow = pad(`Cant: ${qty} ${qtyLabel}`, colDesc);
              doc.text(qtyRow);

              for (let i = 1; i < descLines.length; i += 1) {
                const cont = pad(descLines[i], Math.max(1, colDesc - 1));
                doc.text(cont);
              }
            });

            doc.text(sep);
            const subSin = parseDecimal(payload.subtotal, 2);
            const itbis = parseDecimal(payload.impuestoTotal, 2);
            const descGlob = parseDecimal(payload.descuento, 2);
            const totalPago = parseDecimal(payload.total, 2);
            const labelCol = 16;
            const moneyStr = (v) =>
              `${currency} ${parseDecimal(v, 2).toFixed(2)}`;
            doc.text(`${pad("SUBTOTAL:", labelCol)} ${moneyStr(subSin)}`);
            doc.text(`${pad("ITBIS:", labelCol)} ${moneyStr(itbis)}`);
            if (descGlob > 0)
              doc.text(
                `${pad("DESCUENTO:", labelCol)} - ${moneyStr(descGlob)}`
              );
            doc
              .font("Courier-Bold")
              .fontSize(11)
              .text(`${pad("TOTAL:", labelCol)} ${moneyStr(totalPago)}`);
            doc.font("Courier").fontSize(10);
            doc.moveDown(1);
            if (
              payload.pago &&
              (payload.pago.metodo || "").toLowerCase() === "efectivo"
            ) {
              doc.text(
                `DINERO RECIBIDO:        ${currency} ${parseDecimal(
                  payload.pago.monto,
                  2
                ).toFixed(2)}`,
                { align: "right" }
              );
              doc.text(
                `CAMBIO DEVUELTO:        ${currency} ${parseDecimal(
                  payload.pago.cambio,
                  2
                ).toFixed(2)}`,
                { align: "right" }
              );
              doc.moveDown(1);
            } else if (payload.pago && payload.pago.metodo) {
              const metodo = String(payload.pago.metodo).toUpperCase();
              doc.text(`PAGO REALIZADO: ${metodo}`, { align: "right" });
              doc.moveDown(1);
            }
            if (observaciones) doc.text(`Obs.: ${observaciones}`);
            doc.moveDown(1);
            doc.text(nota1, { align: "center" });
            doc.text(nota2, { align: "center" });
            doc.text(nota3, { align: "center" });
            doc.moveDown(1);
            doc.text("¡Gracias por su compra!", { align: "center" });
            doc.end();
            stream.on("finish", resolve);
            stream.on("error", reject);
          });
        }
      } catch (err) {
        // Si falla PDF, continuamos sin bloquear la venta
        // eslint-disable-next-line no-console
        console.warn("No se pudo generar PDF de factura:", err?.message);
      }

      // guardar ruta en DB si logramos generar el path
      try {
        if (ventaIdDb) {
          await createRequest(pool)
            .input("VentaID", sql.Int, ventaIdDb)
            .input("PdfPath", sql.NVarChar(500), pdfPath.replace(/\\/g, "/"))
            .query(
              "UPDATE dbo.Ventas SET PdfPath=@PdfPath WHERE VentaID=@VentaID;"
            );
        }
      } catch {}

      return res
        .status(201)
        .json({
          ventaId: ventaIdDb || payload.ventaId,
          pdfPath: pdfPath.replace(/\\/g, "/"),
        });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error creando venta:", err);
    const status =
      err.status && Number.isInteger(err.status) ? err.status : 500;
    return res
      .status(status)
      .json({ message: err.message || "Error creando la venta" });
  }
};

// Listado de ventas con filtros basicos
const listarVentas = async (req, res) => {
  try {
    const pool = await poolPromise;

    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : null;
    const estado = (req.query.estado || "").trim();
    const conds = [];
    const r = pool.request();
    if (from && !Number.isNaN(from.getTime())) {
      conds.push("FechaVenta >= @from");
      r.input("from", sql.DateTime, from);
    }
    if (to && !Number.isNaN(to.getTime())) {
      conds.push("FechaVenta <= @to");
      r.input("to", sql.DateTime, to);
    }
    if (clienteId) {
      conds.push("ClienteID = @cid");
      r.input("cid", sql.Int, clienteId);
    }
    if (estado) {
      conds.push("Estado = @est");
      r.input("est", sql.NVarChar(20), estado);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const q = await r.query(`
      SELECT TOP 100 VentaID, FechaVenta, Total, UsuarioID, ClienteID, Estado, FormaPago, Observaciones, Subtotal, DescuentoTotal, ImpuestoTotal
      FROM dbo.Ventas ${where}
      ORDER BY FechaVenta DESC, VentaID DESC
    `);
    res.json(q.recordset || []);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener ventas" });
  }
};

// Obtener una venta con su detalle
const obtenerVenta = async (req, res) => {
  try {
    const ventaId = Number(req.params.ventaId);
    if (!ventaId) return res.status(400).json({ message: "ventaId requerido" });
    const pool = await poolPromise;
    const cab = await pool
      .request()
      .input("id", sql.Int, ventaId)
      .query(
        `SELECT VentaID, FechaVenta, Total, UsuarioID, ClienteID, Estado, FormaPago, Observaciones, Subtotal, DescuentoTotal, ImpuestoTotal
       FROM dbo.Ventas WHERE VentaID=@id`
      );
    if (!cab.recordset.length)
      return res.status(404).json({ message: "Venta no encontrada" });
    const det = await pool
      .request()
      .input("id", sql.Int, ventaId)
      .query(
        `SELECT dv.DetalleID, dv.ProductoID, dv.LoteID, dv.PrecioUnitario,
              dv.CantidadEmpaquesVendidos, dv.CantidadUnidadesMinimasVendidas,
              p.NombreProducto, p.Presentacion, l.NumeroLote
       FROM dbo.DetalleVenta dv
       LEFT JOIN dbo.Productos p ON p.ProductoID = dv.ProductoID
       LEFT JOIN dbo.Lotes l ON l.LoteID = dv.LoteID
       WHERE dv.VentaID = @id`
      );
    res.json({ cabecera: cab.recordset[0], detalle: det.recordset });
  } catch (err) {
    res.status(500).json({ message: "Error al obtener la venta" });
  }
};

const devolucionVenta = async (req, res) => {
  const httpError = (status, message) =>
    Object.assign(new Error(message), { status });
  try {
    const ventaId = Number(req.params.ventaId);
    const {
      items = [],
      motivo = "",
      formaReintegro = null,
      usuarioId: usuarioIdBody = null,
    } = req.body || {};
    const usuarioId =
      req.user?.sub != null
        ? Number(req.user.sub)
        : usuarioIdBody != null
        ? Number(usuarioIdBody)
        : null;
    if (!ventaId) throw httpError(400, "ventaId requerido");
    if (!usuarioId || !Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw httpError(400, "Usuario no indicado");
    }
    if (!Array.isArray(items) || items.length === 0)
      throw httpError(400, "items requeridos");

    const pool = await poolPromise;
    const meta = await getLotesColumnInfo();

    const ventaQ = await pool
      .request()
      .input("VentaID", sql.Int, ventaId)
      .query(
        "SELECT VentaID, ClienteID, UsuarioID, Estado FROM dbo.Ventas WHERE VentaID=@VentaID"
      );
    if (!ventaQ.recordset.length) throw httpError(404, "Venta no encontrada");
    const ventaRow = ventaQ.recordset[0];
    if (String(ventaRow.Estado || "").toLowerCase() === "anulada") {
      throw httpError(400, "No se puede devolver una venta anulada");
    }

    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      const { factorExpr } = getCantidadExpressions(meta, { alias: "l" });
      const detalleVenta = await createRequest(tx).input(
        "VentaID",
        sql.Int,
        ventaId
      ).query(`
          SELECT dv.DetalleID, dv.ProductoID, dv.LoteID,
                 COALESCE(dv.CantidadEmpaquesVendidos,0) AS CantEmp,
                 COALESCE(dv.CantidadUnidadesMinimasVendidas,0) AS CantUni,
                 COALESCE(dv.PrecioUnitario,0) AS PrecioUnitario,
                 ${factorExpr} AS Factor,
                 l.NumeroLote
          FROM dbo.DetalleVenta dv
          LEFT JOIN dbo.Lotes l ON l.LoteID = dv.LoteID
          WHERE dv.VentaID = @VentaID
        `);
      if (!detalleVenta.recordset.length)
        throw httpError(404, "Venta sin detalle asociado");

      const prevDev = await createRequest(tx).input("VentaID", sql.Int, ventaId)
        .query(`
          SELECT dd.DetalleVentaID,
                 SUM(ISNULL(dd.CantidadEmpaquesDevueltos,0)) AS DevEmp,
                 SUM(ISNULL(dd.CantidadUnidadesMinimasDevueltas,0)) AS DevUni
          FROM dbo.DetalleDevolucion dd
          INNER JOIN dbo.DetalleVenta dv ON dv.DetalleID = dd.DetalleVentaID
          WHERE dv.VentaID = @VentaID
          GROUP BY dd.DetalleVentaID
        `);
      const prevDevMap = new Map();
      for (const r of prevDev.recordset) {
        prevDevMap.set(Number(r.DetalleVentaID), {
          emp: ensurePositiveNumber(r.DevEmp),
          uni: ensurePositiveNumber(r.DevUni),
        });
      }

      const calcTotalUnidades = (emp, uni, factor) =>
        Math.round(
          ensurePositiveNumber(emp) * factor + ensurePositiveNumber(uni)
        );

      const detalleMap = new Map();
      const detalleState = new Map();
      for (const r of detalleVenta.recordset) {
        const factor =
          ensurePositiveNumber(r.Factor, DEFAULT_FACTOR_UNIDADES) || 1;
        const vendidas = calcTotalUnidades(r.CantEmp, r.CantUni, factor);
        const prev = prevDevMap.get(Number(r.DetalleID)) || { emp: 0, uni: 0 };
        const devPrev = calcTotalUnidades(prev.emp, prev.uni, factor);
        const restante = Math.max(0, vendidas - devPrev);
        detalleMap.set(Number(r.DetalleID), r);
        detalleState.set(Number(r.DetalleID), {
          vendidas,
          devPrev,
          restante,
          factor,
        });
      }

      const devInsert = await createRequest(tx)
        .input("VentaID", sql.Int, ventaId)
        .input(
          "ClienteID",
          sql.Int,
          ventaRow.ClienteID == null ? null : Number(ventaRow.ClienteID)
        )
        .input("UsuarioID", sql.Int, usuarioId)
        .input("Motivo", sql.NVarChar(400), motivo || null)
        .input("FormaReintegro", sql.NVarChar(50), formaReintegro || null)
        .query(`
          INSERT INTO dbo.Devoluciones (VentaID, ClienteID, UsuarioID, Motivo, FormaReintegro)
          OUTPUT INSERTED.DevolucionID
          VALUES (@VentaID, @ClienteID, @UsuarioID, @Motivo, @FormaReintegro);
        `);
      const devolucionId = devInsert.recordset?.[0]?.DevolucionID;

      for (const it of items) {
        const detalleIdRaw =
          it.detalleVentaId ??
          it.DetalleVentaID ??
          it.detalleId ??
          it.DetalleID ??
          it.idDetalle ??
          it.detalle_id;
        const pid = Number(
          it.productoId ??
            it.ProductoID ??
            it.producto_id ??
            it.idProducto ??
            it.id_producto ??
            0
        );
        const loteId = Number(
          it.loteId || it.LoteID || it.lote_id || it.idLote || it.id_lote || 0
        );

        let detalleId = Number(detalleIdRaw);
        let detalleRow = detalleMap.get(detalleId);

        const empDev = ensurePositiveNumber(
          it.cantidadEmpaquesDevueltos ??
            it.CantidadEmpaquesDevueltos ??
            it.cantidadEmpaques ??
            it.CantidadEmpaques ??
            it.cantEmpaques,
          0
        );
        const uniDev = ensurePositiveNumber(
          it.cantidadUnidadesMinimasDevueltas ??
            it.CantidadUnidadesMinimasDevueltas ??
            it.cantidadUnidades ??
            it.CantidadUnidades ??
            it.cantUnidadesMinimas,
          0
        );
        const unidadesDirectas = ensurePositiveNumber(
          it.unidades ?? it.Unidades ?? it.cantidad ?? it.Cantidad,
          0
        );

        const pickDetalle = () => {
          if (detalleRow) return detalleRow;
          const candidatos = [];
          for (const r of detalleVenta.recordset) {
            if (pid && Number(r.ProductoID) !== pid) continue;
            if (loteId && Number(r.LoteID) !== loteId) continue;
            candidatos.push(r);
          }
          return candidatos[0] || null;
        };

        detalleRow = detalleRow || pickDetalle();
        if (!detalleRow)
          throw httpError(
            400,
            "DetalleVentaID invalido o no pertenece a la venta"
          );

        detalleId = Number(detalleRow.DetalleID);
        const state = detalleState.get(detalleId) || {
          vendidas: 0,
          devPrev: 0,
          restante: 0,
          factor:
            ensurePositiveNumber(detalleRow.Factor, DEFAULT_FACTOR_UNIDADES) ||
            1,
        };
        const factor =
          ensurePositiveNumber(state.factor, DEFAULT_FACTOR_UNIDADES) || 1;

        if (
          detalleRow.LoteID &&
          loteId &&
          Number(detalleRow.LoteID) !== loteId
        ) {
          throw httpError(
            400,
            "El lote del item no coincide con la venta original"
          );
        }

        const totalFromEmpUni = ensurePositiveNumber(empDev * factor + uniDev);
        const unidadesDevueltas =
          unidadesDirectas > 0
            ? ensurePositiveNumber(unidadesDirectas * factor)
            : totalFromEmpUni;
        const empDevFinal = Math.round(
          unidadesDirectas > 0 ? unidadesDirectas : empDev
        );
        const uniDevFinal = Math.round(unidadesDevueltas);

        if (unidadesDevueltas <= 0)
          throw httpError(400, "Las unidades devueltas deben ser mayores a 0");
        if (unidadesDevueltas > state.restante) {
          throw httpError(
            400,
            "La cantidad devuelta excede lo vendido en el detalle"
          );
        }

        await createRequest(tx)
          .input("DevolucionID", sql.Int, devolucionId)
          .input("DetalleVentaID", sql.Int, detalleId)
          .input("ProductoID", sql.Int, detalleRow.ProductoID)
          .input("LoteID", sql.Int, detalleRow.LoteID || null)
          .input("CantidadEmpaquesDevueltos", sql.Int, Math.round(empDevFinal))
          .input(
            "CantidadUnidadesMinimasDevueltas",
            sql.Int,
            Math.round(uniDevFinal)
          )
          .input(
            "PrecioUnitario",
            sql.Decimal(10, 2),
            parseDecimal(detalleRow.PrecioUnitario)
          )
          .input("MotivoRenglon", sql.NVarChar(200), it.motivoRenglon || null)
          .query(`
            INSERT INTO dbo.DetalleDevolucion
              (DevolucionID, DetalleVentaID, ProductoID, LoteID,
               CantidadEmpaquesDevueltos, CantidadUnidadesMinimasDevueltas,
               PrecioUnitario, MotivoRenglon)
            VALUES (@DevolucionID, @DetalleVentaID, @ProductoID, @LoteID,
                    @CantidadEmpaquesDevueltos, @CantidadUnidadesMinimasDevueltas,
                    @PrecioUnitario, @MotivoRenglon);
          `);

        if (detalleRow.LoteID) {
          detalleState.set(detalleId, {
            ...state,
            restante: Math.max(0, state.restante - unidadesDevueltas),
            devPrev: state.devPrev + unidadesDevueltas,
          });
          const loteQ = await createRequest(tx).input(
            "LoteID",
            sql.Int,
            Number(detalleRow.LoteID)
          ).query(`
              SELECT l.LoteID, l.ProductoID, COALESCE(l.Activo,1) AS Activo,
                     ${
                       meta.hasCantidad
                         ? "COALESCE(l.Cantidad,0) AS Cantidad,"
                         : "0 AS Cantidad,"
                     }
                     ${
                       meta.hasCantidadEmpaques
                         ? "COALESCE(l.CantidadEmpaques,0) AS CantidadEmpaques,"
                         : "0 AS CantidadEmpaques,"
                     }
                     ${
                       meta.hasCantidadUnidades
                         ? "COALESCE(l.CantidadUnidadesMinimas,0) AS CantidadUnidadesMinimas,"
                         : "0 AS CantidadUnidadesMinimas,"
                     }
                     ${
                       meta.hasTotalUnidades
                         ? "COALESCE(l.TotalUnidadesMinimas,0) AS TotalUnidadesMinimas,"
                         : "0 AS TotalUnidadesMinimas,"
                     }
                     ${factorExpr} AS Factor
              FROM dbo.Lotes l WHERE l.LoteID = @LoteID
            `);
          if (!loteQ.recordset.length)
            throw httpError(404, "Lote no encontrado");
          const loteRow = loteQ.recordset[0];
          if (loteRow.ProductoID !== detalleRow.ProductoID) {
            throw httpError(
              400,
              "El lote no pertenece al producto de la venta"
            );
          }
          const factorLote = ensurePositiveNumber(loteRow.Factor, factor) || 1;
          const totalActual = meta.hasTotalUnidades
            ? ensurePositiveNumber(loteRow.TotalUnidadesMinimas)
            : meta.hasCantidad
            ? ensurePositiveNumber(loteRow.Cantidad)
            : ensurePositiveNumber(loteRow.CantidadEmpaques) * factorLote;
          const nuevoTotal = totalActual + unidadesDevueltas;
          const nv = splitUnitsToCounts(nuevoTotal, factorLote, meta);

          const reqUp = createRequest(tx).input(
            "LoteID",
            sql.Int,
            Number(detalleRow.LoteID)
          );
          const parts = [];
          if (meta.hasCantidad) {
            parts.push("Cantidad = @Cantidad");
            reqUp.input(
              "Cantidad",
              sql.Int,
              Math.round(nv.cantidad ?? nuevoTotal)
            );
          }
          if (meta.hasCantidadEmpaques) {
            parts.push("CantidadEmpaques = @CantidadEmpaques");
            reqUp.input(
              "CantidadEmpaques",
              sql.Int,
              Math.round(nv.empaques ?? 0)
            );
          }
          if (meta.hasTotalUnidades) {
            parts.push("TotalUnidadesMinimas = @TotalUnidadesMinimas");
            reqUp.input(
              "TotalUnidadesMinimas",
              sql.Int,
              Math.round(nv.totalUnidades ?? nuevoTotal)
            );
          }
          if (parts.length) {
            await reqUp.query(
              `UPDATE dbo.Lotes SET ${parts.join(", ")} WHERE LoteID = @LoteID;`
            );
          }

          await createRequest(tx)
            .input("ProductoID", sql.Int, Number(detalleRow.ProductoID))
            .input("Cantidad", sql.Int, Math.round(unidadesDevueltas)).query(`
              UPDATE dbo.Productos
              SET StockActual = COALESCE(StockActual,0) + @Cantidad,
                  FechaModificacion = GETDATE()
              WHERE ProductoID = @ProductoID;
            `);

          await ensureHistorialTable(pool);
          const detalleHist = `+${Math.round(
            unidadesDevueltas
          )} unidades - Motivo: Devolucion - Venta ${ventaId} - Lote ${
            detalleRow.LoteID
          }${motivo ? ` - ${motivo}` : ""}`;
          await createRequest(tx)
            .input("LoteID", sql.Int, Number(detalleRow.LoteID))
            .input("UsuarioID", sql.Int, usuarioId)
            .input("Accion", sql.NVarChar(50), "Devolucion")
            .input("Detalle", sql.NVarChar(4000), detalleHist.slice(0, 4000))
            .query(`
              INSERT INTO dbo.InventarioLoteHistorial (LoteID, UsuarioID, Accion, Detalle)
              VALUES (@LoteID, @UsuarioID, @Accion, @Detalle);
            `);
        }
      }

      await tx.commit();
      return res.json({ message: "Devolucion registrada", devolucionId });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    const status =
      err.status && Number.isInteger(err.status) ? err.status : 500;
    return res
      .status(status)
      .json({ message: err.message || "Error al aplicar devolucion" });
  }
};

const anularVenta = async (req, res) => {
  try {
    const ventaId = Number(req.params.ventaId);
    const { motivo = "" } = req.body || {};
    const venta = { ventaId };
    if (String(venta.estado || "").toLowerCase() === "anulada") {
      return res.status(400).json({ message: "La venta ya esta anulada" });
    }

    const pool = await poolPromise;
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      const meta = await getLotesColumnInfo();
      const { factorExpr } = getCantidadExpressions(meta, { alias: "l" });
      for (const it of venta.items || []) {
        const reqL = createRequest(tx).input(
          "LoteID",
          sql.Int,
          Number(it.loteId)
        );
        const q = await reqL.query(`SELECT l.LoteID, l.ProductoID,
          ${meta.hasCantidad ? "COALESCE(l.Cantidad,0)" : "0"} AS Cantidad,
          ${
            meta.hasCantidadEmpaques ? "COALESCE(l.CantidadEmpaques,0)" : "0"
          } AS CantidadEmpaques,
          ${
            meta.hasCantidadUnidades
              ? "COALESCE(l.CantidadUnidadesMinimas,0)"
              : "0"
          } AS CantidadUnidadesMinimas,
          ${
            meta.hasTotalUnidades ? "COALESCE(l.TotalUnidadesMinimas,0)" : "0"
          } AS CantidadTotalMinima,
          ${factorExpr} AS Factor
          FROM dbo.Lotes l WHERE l.LoteID = @LoteID`);
        if (!q.recordset.length) continue;
        const r = q.recordset[0];
        const factor = ensurePositiveNumber(r.Factor, 1) || 1;
        const totalActual = meta.hasTotalUnidades
          ? ensurePositiveNumber(r.CantidadTotalMinima)
          : meta.hasCantidad
          ? ensurePositiveNumber(r.Cantidad)
          : ensurePositiveNumber(r.CantidadEmpaques) * factor;
        const nuevoTotal = totalActual + ensurePositiveNumber(it.unidades);
        const nv = splitUnitsToCounts(nuevoTotal, factor, meta);
        const parts = [];
        const reqUp = createRequest(tx).input(
          "LoteID",
          sql.Int,
          Number(r.LoteID)
        );
        if (meta.hasCantidad) {
          parts.push("Cantidad = @Cantidad");
          reqUp.input(
            "Cantidad",
            sql.Int,
            Math.round(nv.cantidad ?? nuevoTotal)
          );
        }
        if (meta.hasCantidadEmpaques) {
          parts.push("CantidadEmpaques = @CantidadEmpaques");
          reqUp.input(
            "CantidadEmpaques",
            sql.Int,
            Math.round(nv.empaques ?? 0)
          );
        }
        if (meta.hasCantidadUnidades) {
          parts.push("CantidadUnidadesMinimas = @CantidadUnidades");
          reqUp.input(
            "CantidadUnidades",
            sql.Int,
            Math.round(nv.unidades ?? 0)
          );
        }
        if (meta.hasTotalUnidades) {
          parts.push("TotalUnidadesMinimas = @TotalUnidades");
          reqUp.input(
            "TotalUnidades",
            sql.Int,
            Math.round(nv.totalUnidades ?? nuevoTotal)
          );
        }
        if (parts.length)
          await reqUp.query(
            `UPDATE dbo.Lotes SET ${parts.join(", ")} WHERE LoteID = @LoteID;`
          );
        await createRequest(tx)
          .input("ProductoID", sql.Int, Number(r.ProductoID))
          .input(
            "Cantidad",
            sql.Int,
            Math.round(ensurePositiveNumber(it.unidades))
          )
          .query(
            `UPDATE dbo.Productos SET StockActual = COALESCE(StockActual,0) + @Cantidad, FechaModificacion = GETDATE() WHERE ProductoID = @ProductoID;`
          );
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    const updated = updateVenta(ventaId, {
      estado: "Anulada",
      motivoAnulacion: motivo,
      fechaAnulacion: new Date().toISOString(),
    });
    res.json({ message: "Venta anulada", venta: updated });
  } catch (err) {
    res.status(500).json({ message: err.message || "Error al anular venta" });
  }
};

const obtenerPdf = async (req, res) => {
  try {
    const ventaId = Number(req.params.ventaId);
    // No dependemos de JSON; verificamos archivo PDF disponible
    // Buscar archivo mas reciente por patron
    const files = fs.existsSync(FACTURAS_DIR)
      ? fs.readdirSync(FACTURAS_DIR)
      : [];
    const prefix = `factura_${ventaId}_`;
    const found = files
      .filter((f) => f.startsWith(prefix) && f.endsWith(".pdf"))
      .sort()
      .pop();
    if (!found) return res.status(404).json({ message: "PDF no disponible" });
    const filePath = path.join(FACTURAS_DIR, found);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${found}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener PDF" });
  }
};

module.exports = {
  crearVenta,
  listarVentas,
  obtenerVenta,
  devolucionVenta,
  anularVenta,
  obtenerPdf,
  historialDia,
};
