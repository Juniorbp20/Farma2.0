// controllers/ventasController.js
// Crear venta (ajusta stock en DB vía Lotes/Productos). No persiste encabezado/detalle.
const sql = require('mssql');
const poolPromise = require('../db');
const { consumirDesdeLotes } = require('./inventarioController');
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
        const quitar = Number(it.Cantidad || it.cantidad || 0);
        const productoId = Number(it.ProductoID ?? it.productoId);
        if (!productoId || quitar <= 0) continue;
        await consumirDesdeLotes(tx, productoId, quitar);
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
