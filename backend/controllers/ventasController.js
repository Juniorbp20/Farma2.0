// controllers/ventasController.js
// Crear venta (ajusta stock en DB vía Lotes/Productos). No persiste encabezado/detalle.
const sql = require('mssql');
const poolPromise = require('../db');
let contadorVentas = 1;

const crearVenta = async (req, res) => {
  try {
    const { cliente, items, pago, descuento = 0 } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La venta debe incluir ítems.' });
    }

    const subtotal = items.reduce((acc, it) => acc + (Number(it.Precio) * Number(it.Cantidad)), 0);
    const total = Math.max(0, subtotal - Number(descuento || 0));

    // Número de venta simple secuencial + fecha
    const numero = `V-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(contadorVentas++).padStart(4,'0')}`;

    const venta = {
      numero,
      fecha: new Date().toISOString(),
      cliente: cliente || null,
      items,
      subtotal,
      descuento: Number(descuento || 0),
      total,
      pago: pago || { metodo: 'efectivo', monto: total, cambio: 0 },
      usuario: req.user || null,
    };

    // Calcular cambio si aplica
    if (venta.pago && venta.pago.metodo === 'efectivo') {
      const monto = Number(venta.pago.monto || 0);
      venta.pago.cambio = Math.max(0, monto - total);
    }

    // Ajustar stock en DB transaccionalmente
    const pool = await poolPromise;
    const tx = new sql.Transaction(await pool);
    await tx.begin();
    try {
      for (const it of items) {
        const quitar = Number(it.Cantidad || 0);
        if (!it.ProductoID || quitar <= 0) continue;
        // Consumir lotes FIFO por vencimiento
        const q = await new sql.Request(tx)
          .input('ProductoID', sql.Int, Number(it.ProductoID))
          .query(`SELECT LoteID, Cantidad FROM Lotes WHERE ProductoID=@ProductoID AND Activo=1 AND Cantidad>0 ORDER BY FechaVencimiento, LoteID`);
        let restante = quitar;
        for (const l of q.recordset) {
          if (restante <= 0) break;
          const take = Math.min(restante, Number(l.Cantidad));
          await new sql.Request(tx)
            .input('LoteID', sql.Int, l.LoteID)
            .input('take', sql.Int, take)
            .query(`UPDATE Lotes SET Cantidad = Cantidad - @take WHERE LoteID = @LoteID;`);
          restante -= take;
        }
        const consumido = quitar - restante;
        await new sql.Request(tx)
          .input('ProductoID', sql.Int, Number(it.ProductoID))
          .input('consumido', sql.Int, consumido + Math.max(0, restante))
          .query(`UPDATE Productos SET StockActual = CASE WHEN StockActual >= @consumido THEN StockActual - @consumido ELSE 0 END WHERE ProductoID=@ProductoID;`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }

    // En una implementación real se insertaría en Ventas/DetalleVenta aquí
    return res.status(201).json(venta);
  } catch (err) {
    console.error('Error creando venta:', err);
    return res.status(500).json({ message: 'Error creando la venta' });
  }
};

module.exports = { crearVenta };
