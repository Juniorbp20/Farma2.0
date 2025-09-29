// src/pages/PuntoVentaPage.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getClientes } from '../services/clientesService';
import ProductSelector from '../components/ProductSelector';
import { crearVenta } from '../services/salesService';
import { formatCurrency } from '../utils/formatters';
import ConfirmModal from '../components/ConfirmModal';

function LineaCarrito({ item, onQty, onRemove }) {
  const total = formatCurrency(item.Precio * item.Cantidad);
  return (
    <tr>
      <td>{item.ProductoID}</td>
      <td>{item.Nombre}</td>
      <td className="text-end">{formatCurrency(item.Precio)}</td>
      <td style={{ width: 140 }}>
        <div className="input-group input-group-sm">
          <button className="btn btn-outline-secondary" onClick={() => onQty(item, Math.max(1, item.Cantidad - 1))} title="-1"><i className="bi bi-dash"></i></button>
          <input type="number" min={1} className="form-control text-center" value={item.Cantidad}
            onChange={(e) => onQty(item, Math.max(1, Number(e.target.value)||1))} />
          <button className="btn btn-outline-secondary" onClick={() => onQty(item, item.Cantidad + 1)} title="+1"><i className="bi bi-plus"></i></button>
        </div>
      </td>
      <td className="text-end fw-semibold">{total}</td>
      <td className="text-center" style={{ width: 48 }}>
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(item)} title="Quitar"><i className="bi bi-trash"></i></button>
      </td>
    </tr>
  );
}

export default function PuntoVentaPage({ user }) {
  const [clientes, setClientes] = useState([]);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  
  const [barcode, setBarcode] = useState('');
  const [carrito, setCarrito] = useState([]); // items: {ProductoID, Nombre, Precio, Cantidad}
  const [descuento, setDescuento] = useState(0);
  const [metodo, setMetodo] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [okVenta, setOkVenta] = useState(null);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const inputBarcodeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { setClientes(await getClientes()); } catch {}
    })();
  }, []);

  const subtotal = useMemo(() => carrito.reduce((acc, it) => acc + it.Precio * it.Cantidad, 0), [carrito]);
  const total = useMemo(() => Math.max(0, subtotal - Number(descuento || 0)), [subtotal, descuento]);
  const cambio = useMemo(() => metodo === 'efectivo' ? Math.max(0, Number(montoRecibido || 0) - total) : 0, [metodo, montoRecibido, total]);

  const agregarAlCarrito = (prod) => {
    setError('');
    setOkVenta(null);
    setCarrito((prev) => {
      const idx = prev.findIndex((p) => p.ProductoID === prod.ProductoID);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], Cantidad: copy[idx].Cantidad + 1 };
        return copy;
      }
      return [...prev, { ...prod, Cantidad: 1 }];
    });
  };

  const agregarPorBarcode = async (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const id = Number(code);
    if (!Number.isNaN(id) && id > 0) {
      const found = await buscarProductos(id.toString()).then(results => results.find(s => s.ProductoID === id));
      if (found) agregarAlCarrito(found); else setError('Código no disponible');
    } else {
      setError('Código no disponible');
    }
    setBarcode('');
  };

  const cambiarCantidad = (item, qty) => {
    setCarrito(prev => prev.map(p => p.ProductoID === item.ProductoID ? { ...p, Cantidad: qty } : p));
  };

  const quitarItem = (item) => setCarrito(prev => prev.filter(p => p.ProductoID !== item.ProductoID));

  const limpiarVenta = () => {
    setCarrito([]);
    setDescuento(0);
    setMetodo('efectivo');
    setMontoRecibido('');
    setOkVenta(null);
    setError('');
    setClienteSel(null);
    setFiltroCliente('');
    inputBarcodeRef.current?.focus();
  };

  const finalizarVenta = async () => {
    try {
      setGuardando(true);
      setError('');
      setOkVenta(null);
      setShowConfirmModal(false);

      if (carrito.length === 0) { setError('Agregue productos al carrito.'); return; }
      if (metodo === 'efectivo' && Number(montoRecibido || 0) < total) { setError('Monto recibido insuficiente.'); return; }

      const payload = {
        cliente: clienteSel ? { ClienteID: clienteSel.ClienteID, Nombre: `${clienteSel.Nombres} ${clienteSel.Apellidos}` } : null,
        items: carrito.map(it => ({ ProductoID: it.ProductoID, Nombre: it.Nombre, Precio: it.Precio, Cantidad: it.Cantidad })),
        descuento: Number(descuento || 0),
        pago: { metodo, monto: metodo === 'efectivo' ? Number(montoRecibido || 0) : total },
      };
      const resp = await crearVenta(payload);
      setOkVenta(resp);
      setCarrito([]);
      setMontoRecibido('');
    } catch (e) {
      setError(typeof e?.message === 'string' ? e.message : 'Error al crear la venta');
    } finally {
      setGuardando(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const f = (filtroCliente || '').toLowerCase();
    if (!f) return clientes.slice(0, 50);
    return clientes.filter(c =>
      (c.Nombres + ' ' + c.Apellidos).toLowerCase().includes(f) ||
      (c.Documento || '').toLowerCase().includes(f)
    ).slice(0, 50);
  }, [clientes, filtroCliente]);

  return (
    <div className="container py-3">
      <h3 className="mb-3"><i className="bi bi-cash-register me-2"></i>Punto de Venta</h3>

      {error && (<div className="alert alert-danger py-2" role="alert">{error}</div>)}
      )
      }
      {okVenta && (
        <div className="alert alert-success py-2" role="alert">
          Venta registrada: <strong>{okVenta.numero}</strong> — Total: <strong>{formatCurrency(okVenta.total)}</strong>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-6">
                  <label className="form-label">Buscar producto</label>
                  <ProductSelector onSelect={agregarAlCarrito} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Escanear ID de producto</label>
                  <form onSubmit={agregarPorBarcode} className="d-flex gap-2">
                    <input ref={inputBarcodeRef} className="form-control" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Ej. 123" />
                    <button className="btn btn-primary" type="submit"><i className="bi bi-upc-scan me-1"></i>Agregar</button>
                  </form>
                </div>
              </div>

              <div className="table-responsive mt-3">
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{width:130}}>ID</th>
                      <th>Producto</th>
                      <th className="text-end" style={{width:100}}>Precio</th>
                      <th style={{width:140}}>Cantidad</th>
                      <th className="text-end" style={{width:110}}>Importe</th>
                      <th style={{width:48}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-3">Sin productos</td></tr>
                    )}
                    {carrito.map(it => (
                      <LineaCarrito key={it.ProductoID} item={it} onQty={cambiarCantidad} onRemove={quitarItem} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-2">
                <button className="btn btn-outline-secondary" onClick={limpiarVenta}><i className="bi bi-trash me-1"></i>Limpiar</button>
                <div className="text-end">
                  <div>Subtotal: <strong>{formatCurrency(subtotal)}</strong></div>
                  <div className="d-flex align-items-center justify-content-end gap-2 mt-1">
                    <label className="form-label m-0">Descuento</label>
                    <input type="number" min={0} step="0.01" className="form-control form-control-sm" style={{width:120}} value={descuento} onChange={(e) => setDescuento(e.target.value)} />
                  </div>
                  <div className="fs-5 mt-1">Total: <strong>{formatCurrency(total)}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <h6 className="mb-3"><i className="bi bi-person me-2"></i>Cliente</h6>
              <input className="form-control form-control-sm mb-2" placeholder="Buscar por nombre o documento" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
              <select className="form-select form-select-sm" size={6} value={clienteSel?.ClienteID || ''} onChange={(e) => { const id = Number(e.target.value); setClienteSel(clientes.find(c => c.ClienteID === id) || null); }}>
                <option value="">Consumidor final</option>
                {clientesFiltrados.map(c => (
                  <option key={c.ClienteID} value={c.ClienteID}>
                    {c.Documento ? `[${c.Documento}] ` : ''}{c.Nombres} {c.Apellidos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="mb-3"><i className="bi bi-credit-card me-2"></i>Pago</h6>
              <div className="mb-2">
                <label className="form-label">Método</label>
                <select className="form-select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              {metodo === 'efectivo' && (
                <div className="mb-2">
                  <label className="form-label">Monto recibido</label>
                  <input className="form-control" type="number" min={0} step="0.01" value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} />
                  <div className="mt-1">Cambio: <strong>{formatCurrency(cambio)}</strong></div>
                </div>
              )}
              <button className="btn btn-success w-100 mt-2" onClick={() => setShowConfirmModal(true)} disabled={guardando || carrito.length===0}>
                {guardando ? 'Procesando...' : 'Finalizar Venta'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={showConfirmModal}
        title="Confirmar Venta"
        message={`¿Confirmar venta por ${formatCurrency(total)}?`}
        onConfirm={finalizarVenta}
        onCancel={() => setShowConfirmModal(false)}
        confirmText="Confirmar Venta"
      />
    </div>
  );
}

