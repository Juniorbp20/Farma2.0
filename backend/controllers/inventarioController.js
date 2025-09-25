// controllers/inventarioController.js
// Implementación contra SQL Server (tablas Lotes y Productos)
const sql = require('mssql');
const poolPromise = require('../db');

const getLotes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      SELECT l.LoteID, l.ProductoID, l.NumeroLote AS Lote, l.Cantidad, l.FechaVencimiento AS Vencimiento, l.FechaIngreso, l.Activo,
             p.NombreProducto AS Producto, p.Presentacion
      FROM Lotes l
      INNER JOIN Productos p ON p.ProductoID = l.ProductoID
      WHERE l.Activo = 1
      ORDER BY l.FechaVencimiento, l.LoteID
    `);
    res.json(q.recordset);
  } catch (err) {
    console.error('getLotes error:', err);
    res.status(500).json({ message: 'Error al obtener lotes' });
  }
};

const addLote = async (req, res) => {
  try {
    const { ProductoID, Lote, Vencimiento, Cantidad } = req.body || {};
    if (!ProductoID || !Lote || !Vencimiento || !Cantidad) return res.status(400).json({ message: 'Faltan datos del lote' });
    const pool = await poolPromise;
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      const reqTx = new sql.Request(tx);
      await reqTx
        .input('ProductoID', sql.Int, Number(ProductoID))
        .input('NumeroLote', sql.NVarChar(100), String(Lote))
        .input('FechaVencimiento', sql.Date, Vencimiento)
        .input('Cantidad', sql.Int, Number(Cantidad))
        .query(`
          INSERT INTO Lotes (ProductoID, NumeroLote, Cantidad, FechaVencimiento, FechaIngreso, Activo)
          VALUES (@ProductoID, @NumeroLote, @Cantidad, @FechaVencimiento, GETDATE(), 1);
          UPDATE Productos SET StockActual = StockActual + @Cantidad WHERE ProductoID = @ProductoID;
        `);
      await tx.commit();
      res.status(201).json({ message: 'Lote agregado' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error('addLote error:', err);
    res.status(500).json({ message: 'Error al agregar lote' });
  }
};

async function consumirDesdeLotesDB(conn, productoId, cantidad) {
  // conn puede ser pool (ConnectionPool) o transacción (Transaction)
  const req = (conn.request ? conn.request() : new sql.Request(conn));
  const q = await req
    .input('ProductoID', sql.Int, Number(productoId))
    .query(`
      SELECT LoteID, Cantidad
      FROM Lotes
      WHERE ProductoID = @ProductoID AND Activo = 1 AND Cantidad > 0
      ORDER BY FechaVencimiento, LoteID
    `);
  let restante = Number(cantidad);
  for (const l of q.recordset) {
    if (restante <= 0) break;
    const take = Math.min(restante, Number(l.Cantidad));
    const req2 = (conn.request ? conn.request() : new sql.Request(conn));
    await req2
      .input('LoteID', sql.Int, l.LoteID)
      .input('take', sql.Int, take)
      .query(`UPDATE Lotes SET Cantidad = Cantidad - @take WHERE LoteID = @LoteID;`);
    restante -= take;
  }
  const consumido = Number(cantidad) - restante;
  const req3 = (conn.request ? conn.request() : new sql.Request(conn));
  await req3
    .input('ProductoID', sql.Int, Number(productoId))
    .input('consumido', sql.Int, consumido)
    .query(`UPDATE Productos SET StockActual = CASE WHEN StockActual >= @consumido THEN StockActual - @consumido ELSE 0 END WHERE ProductoID = @ProductoID;`);
  return consumido;
}

const ajustarStock = async (req, res) => {
  try {
    let { ProductoID, Cantidad } = req.body || {};
    Cantidad = Number(Cantidad);
    if (!ProductoID || !Cantidad || isNaN(Cantidad)) return res.status(400).json({ message: 'Datos inválidos' });
    const pool = await poolPromise;
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      const cx = new sql.Request(tx);
      if (Cantidad > 0) {
        await cx
          .input('ProductoID', sql.Int, Number(ProductoID))
          .input('NumeroLote', sql.NVarChar(100), `AJUSTE-${Date.now()}`)
          .input('Cantidad', sql.Int, Cantidad)
          .query(`
            INSERT INTO Lotes (ProductoID, NumeroLote, Cantidad, FechaVencimiento, FechaIngreso, Activo)
            VALUES (@ProductoID, @NumeroLote, @Cantidad, NULL, GETDATE(), 1);
            UPDATE Productos SET StockActual = StockActual + @Cantidad WHERE ProductoID = @ProductoID;
          `);
        await tx.commit();
        return res.json({ message: 'Ajuste aplicado', aplicado: Cantidad });
      } else {
        const consumido = await consumirDesdeLotesDB(tx, Number(ProductoID), Math.abs(Cantidad));
        await tx.commit();
        return res.json({ message: 'Ajuste aplicado', aplicado: -consumido });
      }
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error('ajustarStock error:', err);
    return res.status(500).json({ message: 'Error al ajustar stock' });
  }
};

const getResumen = async (req, res) => {
  try {
    const pool = await poolPromise;
    const q = await pool.request().query(`
      WITH Prox AS (
        SELECT ProductoID, COUNT(*) AS VencimientosProximos
        FROM Lotes
        WHERE Activo = 1 AND Cantidad > 0 AND FechaVencimiento IS NOT NULL
          AND FechaVencimiento BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(day,30,CAST(GETDATE() AS DATE))
        GROUP BY ProductoID
      )
      SELECT p.ProductoID, p.NombreProducto AS Nombre, p.Presentacion, p.StockActual AS Stock,
             p.StockMinimo, ISNULL(x.VencimientosProximos,0) AS VencimientosProximos
      FROM Productos p
      LEFT JOIN Prox x ON x.ProductoID = p.ProductoID
      WHERE p.Activo = 1
      ORDER BY p.NombreProducto
    `);
    res.json(q.recordset.map(r => ({
      ProductoID: r.ProductoID,
      Nombre: r.Nombre,
      Stock: Number(r.Stock || 0),
      StockMinimo: Number(r.StockMinimo || 0),
      VencimientosProximos: Number(r.VencimientosProximos || 0),
    })));
  } catch (err) {
    console.error('getResumen error:', err);
    res.status(500).json({ message: 'Error al obtener resumen' });
  }
};

module.exports = { getLotes, addLote, ajustarStock, getResumen };
