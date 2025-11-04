// src/pages/PuntoVentaPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PuntoVentaPage.css';
import { getClientes } from '../services/clientesService';
import { buscarProductosConStock, buscarProductos } from '../services/productsService';
import { getLotes } from '../services/inventoryService';
import { crearVenta, getVentaPdf } from '../services/salesService';

function number(val, d = 2) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

  function LineaItem({ item, onChange, onRemove }) {
  const factor = item.factorUnidad || 1;
  const loteSel = item.lotes.find((l) => l.loteId === item.loteId) || null;
  const stockEmp = loteSel ? Number(loteSel.cantidadEmpaques || 0) : 0;
  const stockUni = loteSel ? Number(loteSel.cantidadUnidadesMinimas || 0) : 0;
  const precioMin = loteSel ? Number(loteSel.precioVenta || loteSel.precioUnitarioVenta || 0) : 0;
  const impuesto = loteSel ? Number(loteSel.impuesto || loteSel.porcentajeImpuesto || 0) : 0;
  const descEmp = loteSel ? Number(loteSel.descuento || loteSel.porcentajeDescuentoEmpaque || 0) : 0;

  const modo = 'detalle';
  const cantUni = Number(item.cantUnidadesMinimas || 0);
  const unidades = cantUni;
  const precioEmpaque = (precioMin * factor) * (1 - descEmp);
  const precioUnidadAplicada = precioMin;
  const subtotal = number(unidades * precioUnidadAplicada, 2);
  const imp = number(subtotal * (impuesto / 100), 2);
  const total = number(subtotal + imp, 2);

  const maxUni = stockUni + stockEmp * factor;

  return (
    <tr>
      <td>
        <div className="fw-semibold">{item.nombre}</div>
        <div className="text-muted small">{item.presentacion}</div>
      </td>
      <td>
        <select className="form-select form-select-sm" value={item.loteId || ''}
          onChange={(e) => onChange({ ...item, loteId: Number(e.target.value) })}>
          {item.lotes.map((l) => (
            <option key={l.loteId} value={l.loteId}>
              {(l.numeroLote || `Lote ${l.loteId}`)}{l.fechaVencimiento ? ` - vence ${new Date(l.fechaVencimiento).toLocaleDateString()}` : ''}
            </option>
          ))}
        </select>
      </td>
      <td style={{ width: 150 }}>
        <input type="number" className="form-control form-control-sm" min={0} value={cantUni}
          onChange={(e) => {
            const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
            onChange({ ...item, cantUnidadesMinimas: Math.min(v, maxUni) });
          }} />
      </td>
      <td>
        <div className="small text-muted">
          <span>Stock: {maxUni} unidades</span>
        </div>
      </td>
      <td className="text-end">{precioUnidadAplicada.toFixed(2)}</td>
      <td className="text-end">{impuesto.toFixed(2)}%</td>
      <td className="text-end">{subtotal.toFixed(2)}</td>
      <td className="text-center">
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(item)} title="Quitar"><i className="bi bi-trash"></i></button>
      </td>
    </tr>
  );
}

export default function PuntoVentaPage({ user }) {
  const [clientes, setClientes] = useState([]);
  const [clienteSel, setClienteSel] = useState(null);
  const [estado, setEstado] = useState('Pagada');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugIndex, setSugIndex] = useState(0);

  const [items, setItems] = useState([]);
  const [descuentoTipo, setDescuentoTipo] = useState('%');
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDevolucion, setShowDevolucion] = useState(false);
  const [devSelKey, setDevSelKey] = useState('');
  const [devQty, setDevQty] = useState('');
  const [devMsg, setDevMsg] = useState('');
  const [devReemp, setDevReemp] = useState(false);
  const [devBusca, setDevBusca] = useState('');
  const [devSug, setDevSug] = useState([]);
  const [devSugIndex, setDevSugIndex] = useState(0);
  const [devRep, setDevRep] = useState(null);
  const [devRepLotes, setDevRepLotes] = useState([]);
  const [devRepLoteId, setDevRepLoteId] = useState(null);
  const [devRepQty, setDevRepQty] = useState('');

  const inputBusquedaRef = useRef(null);

  useEffect(() => { (async () => { try { setClientes(await getClientes()); } catch {} })(); }, []);

  // Ocultar el aviso de "venta generada" automáticamente a los 5s
  useEffect(() => {
    if (!ok) return undefined;
    const t = setTimeout(() => setOk(null), 5000);
    return () => clearTimeout(t);
  }, [ok]);

  // Sincronizar estado con forma de pago: si es Crédito, estado => "Credito";
  // si cambia a otra forma (Efectivo/Tarjeta/Transferencia) y el estado estaba en Crédito,
  // regresarlo a "Pagada" para mantener el flujo usual.
  useEffect(() => {
    if (formaPago === 'Credito') {
      if (estado !== 'Credito') setEstado('Credito');
    } else if (estado === 'Credito') {
      setEstado('Pagada');
    }
  }, [formaPago]);

  // Búsqueda de producto reemplazo en devolución
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const q = devBusca.trim();
      if (!showDevolucion || !devReemp || !q) { setDevSug([]); return; }
      try {
        const data = await buscarProductos(q);
        if (!cancel) { setDevSug(data); setDevSugIndex(0); }
      } catch { if (!cancel) setDevSug([]); }
    };
    const t = setTimeout(run, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [devBusca, devReemp, showDevolucion]);

  const canPrint = (() => {
    const r = String(user?.rol || '').toLowerCase();
    return r.includes('admin') || r.includes('cajero');
  })();

  const canReturnItem = (it) => {
    // Regla simple: por defecto permite devolución; ejemplo de restricción por nombre
    const name = (it?.nombre || '').toLowerCase();
    if (name.includes('controlado')) return false;
    return true;
  };

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const q = busqueda.trim();
      if (!q) { setSugerencias([]); return; }
      setLoadingSug(true);
      try {
        // Mostrar productos aunque no tengan stock
        const data = await buscarProductos(q);
        if (!cancel) {
          setSugerencias(Array.isArray(data) ? data : []);
          setSugIndex(0);
        }
      } catch {
        if (!cancel) setSugerencias([]);
      } finally {
        if (!cancel) setLoadingSug(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [busqueda]);

  const calcularTotales = useMemo(() => {
    let subtotal = 0;
    let impuestoTotal = 0;
    items.forEach((it) => {
      const factor = it.factorUnidad || 1;
      const loteSel = it.lotes.find((l) => l.loteId === it.loteId);
      if (!loteSel) return;
      const precioMin = Number(loteSel.precioVenta || loteSel.precioUnitarioVenta || 0);
      const impuesto = Number(loteSel.impuesto || loteSel.porcentajeImpuesto || 0);
      const descEmp = Number(loteSel.descuento || loteSel.porcentajeDescuentoEmpaque || 0);
      const unidades = it.modo === 'empaque' ? Number(it.cantEmpaques || 0) * factor : Number(it.cantUnidadesMinimas || 0);
      const precioEmpaque = (precioMin * factor) * (1 - descEmp);
      const precioUnidadAplicada = it.modo === 'empaque' && factor > 0 ? (precioEmpaque / factor) : precioMin;
      const sub = number(unidades * precioUnidadAplicada, 2);
      const imp = number(sub * (impuesto / 100), 2);
      subtotal += sub;
      impuestoTotal += imp;
    });
    let desc = 0;
    if (descuentoTipo === '%') desc = number(subtotal * (Math.max(0, Math.min(100, Number(descuentoValor || 0))) / 100), 2);
    else desc = number(Math.max(0, Math.min(Number(descuentoValor || 0), subtotal)), 2);
    const total = number(Math.max(0, (subtotal - desc) + impuestoTotal), 2);
    return { subtotal, impuestoTotal, descuento: desc, total };
  }, [items, descuentoTipo, descuentoValor]);

  async function addProducto(prod) {
    setError(''); setOk(null);
    try {
      const lots = await getLotes({ productoId: prod.ProductoID, estado: 'activos' });
      const disponibles = lots.filter(l => (l.diasRestantes == null || l.diasRestantes >= 0) && (l.cantidadEmpaques > 0 || l.cantidadUnidadesMinimas > 0 || l.cantidadTotalMinima > 0));
      const factor = Number(prod.CantidadUnidadMinimaXEmpaque || 1);
      const nuevo = {
        productoId: prod.ProductoID,
        nombre: prod.Nombre,
        presentacion: prod.Presentacion,
        factorUnidad: factor,
        lotes: disponibles.map(l => ({
          loteId: l.loteId,
          numeroLote: l.numeroLote,
          fechaVencimiento: l.fechaVencimiento,
          cantidadEmpaques: l.cantidadEmpaques,
          cantidadUnidadesMinimas: l.cantidadUnidadesMinimas,
          precioUnitarioVenta: l.precioVenta,
          precioVenta: l.precioVenta,
          impuesto: l.impuesto,
          porcentajeImpuesto: l.impuesto,
          descuento: l.descuento,
          porcentajeDescuentoEmpaque: l.descuento,
        })),
        loteId: disponibles[0]?.loteId || null,
        modo: 'detalle',
        metodoPago: formaPago || 'Efectivo',
        cantEmpaques: 0,
        cantUnidadesMinimas: 1,
      };
      setItems(prev => {
        const dup = prev.find(p => p.productoId === nuevo.productoId && p.loteId === nuevo.loteId);
        if (dup) return prev;
        return [...prev, nuevo];
      });
      if (disponibles.length === 0) {
        setError('El producto no tiene lotes activos/no vencidos con stock. Se agregó sin lote.');
      }
      setBusqueda(''); setSugerencias([]); setSugIndex(0); inputBusquedaRef.current?.focus();
    } catch (err) {
      setError('No se pudieron obtener lotes para el producto');
    }
  }

  function onKeyDownBusqueda(e) {
    if (!sugerencias || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSugIndex((prev) => (prev + 1) % sugerencias.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSugIndex((prev) => (prev - 1 + sugerencias.length) % sugerencias.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const prod = sugerencias[Math.max(0, Math.min(sugIndex, sugerencias.length - 1))] || sugerencias[0];
      if (prod) addProducto(prod);
    }
  }

  function openConfirm() {
    if (items.length === 0) { setError('No hay items en el carrito.'); return; }
    if (validarMontoRecibido && !montoRecibidoValido) { setError('El monto recibido en efectivo debe ser un número válido y mayor o igual al total.'); return; }
    if (estado.toLowerCase() === 'credito' && !clienteSel) { setError('Para crédito debe seleccionar cliente.'); return; }
    setShowConfirm(true);
  }

  async function onFinalizar() {
    if (items.length === 0) { setError('No hay items en el carrito.'); return; }
    if (validarMontoRecibido && !montoRecibidoValido) { setError('El monto recibido en efectivo debe ser un número válido y mayor o igual al total.'); return; }
    if (estado.toLowerCase() === 'credito' && !clienteSel) { setError('Para crédito debe seleccionar cliente.'); return; }
    setSaving(true); setError(''); setOk(null);
    try {
      const payload = {
        usuarioId: null,
        clienteId: clienteSel ? clienteSel.ClienteID : null,
        formaPago,
        estado,
        observaciones,
        descuentoGlobal: { tipo: descuentoTipo, valor: Number(descuentoValor || 0) },
        pago: formaPago === 'Efectivo' ? { metodo: 'Efectivo', monto: montoRecibidoNumber } : { metodo: formaPago, monto: 0 },
        items: items.map((it) => ({
          productoId: it.productoId,
          loteId: it.loteId,
          modo: it.modo === 'detalle' ? 'detalle' : 'empaque',
          cantEmpaques: it.cantEmpaques || 0,
          cantUnidadesMinimas: it.cantUnidadesMinimas || 0,
          precioUnitarioVenta: 0,
          porcentajeImpuesto: 0,
          porcentajeDescEmpaque: 0,
        })),
      };
      const resp = await crearVenta(payload);
      setOk(resp);
      // opción de imprimir inmediatamente (con token)
      try {
        if (resp?.ventaId) {
          const { blob, filename } = await getVentaPdf(resp.ventaId);
          const url = URL.createObjectURL(blob);
          const win = window.open(url, '_blank');
          if (!win) {
            // fallback descarga
            const a = document.createElement('a');
            a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
          }
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
      } catch {}
      setItems([]);
      setDescuentoValor(0); setDescuentoTipo('%'); setObservaciones('');
    } catch (err) {
      setError(err.message || 'Error al finalizar la venta');
    } finally { setSaving(false); }
  }

  const { subtotal, impuestoTotal, descuento, total } = calcularTotales;
  const requiereMontoRecibido = formaPago === 'Efectivo';
  const validarMontoRecibido = requiereMontoRecibido && items.length > 0;
  const montoRecibidoNumber = Number(montoRecibido);
  const montoRecibidoIngresado = montoRecibido !== '';
  const montoRecibidoValido = !validarMontoRecibido || (
    montoRecibidoIngresado &&
    Number.isFinite(montoRecibidoNumber) &&
    montoRecibidoNumber >= 0 &&
    Math.round((montoRecibidoNumber - total) * 100) >= 0
  );
  const mostrarErrorMonto = validarMontoRecibido && montoRecibidoIngresado && !montoRecibidoValido;
  const finalizarDisabled = saving || items.length === 0 || (validarMontoRecibido && !montoRecibidoValido);

  return (
    <div className="container py-3">
      <h1 className="page-title display-5 fw-bold text-center opacity-75 mb-3">Facturación</h1>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-8">
              <input
                ref={inputBusquedaRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={onKeyDownBusqueda}
                className="form-control"
                placeholder="Buscar productos..."
              />
              {loadingSug && <div className="small text-muted mt-1">Buscando...</div>}
              {!!sugerencias.length && (
                <div className="list-group mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {sugerencias.map((p, idx) => (
                    <button
                      key={p.ProductoID}
                      className={`list-group-item list-group-item-action d-flex justify-content-between ${idx === sugIndex ? 'active' : ''}`}
                      onMouseEnter={() => setSugIndex(idx)}
                      onClick={() => addProducto(p)}
                    >
                      <span>{p.Nombre}{p.Presentacion ? ` · ${p.Presentacion}` : ''}</span>
                      <i className="bi bi-plus-circle"></i>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-4">
              <div className="row g-2">
                <div className="col-12">
                  <select className="form-select" value={clienteSel?.ClienteID || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value||0);
                      setClienteSel(id ? clientes.find(c => c.ClienteID === id) : null);
                    }}>
                    <option value="">Consumidor final</option>
                    {clientes.map(c => <option key={c.ClienteID} value={c.ClienteID}>{c.Nombres} {c.Apellidos}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-sm align-middle">
              <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                <tr>
                  <th>Producto</th>
                  <th style={{ width: 240 }}>Lote</th>
                  <th style={{ width: 120 }}>Cantidad</th>
                  <th style={{ width: 140 }}>Stock</th>
                  <th className="text-end" style={{ width: 110 }}>P. Unit.</th>
                  <th className="text-end" style={{ width: 90 }}>Imp.</th>
                  <th className="text-end" style={{ width: 110 }}>Subtotal</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <LineaItem key={`${it.productoId}-${it.loteId}`} item={it}
                    onChange={(nuevo) => setItems(prev => prev.map(p => (p.productoId === it.productoId && p.loteId === it.loteId ? nuevo : p)))}
                    onRemove={() => setItems(prev => prev.filter(p => !(p.productoId === it.productoId && p.loteId === it.loteId)))} />
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-muted py-4">No hay productos en el carrito.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card h-100"><div className="card-body">
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">Forma de pago</label>
                <select className="form-select" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                  <option>Efectivo</option>
                  <option>Tarjeta</option>
                  <option>Transferencia</option>
                  <option>Credito</option>
                </select>
              </div>
              {formaPago === 'Efectivo' && (
                <div className="col-6">
                  <label className="form-label">Monto recibido</label>
                  <input
                    type="number"
                    min={Math.max(0, total)}
                    step="0.01"
                    placeholder={`Monto >= ${total.toFixed(2)}`}
                    className={`form-control ${mostrarErrorMonto ? 'is-invalid' : ''}`}
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                  />
                  {validarMontoRecibido && !mostrarErrorMonto && (
                    <div className="form-text">Debe cubrir al menos el total ({total.toFixed(2)}).</div>
                  )}
                  {mostrarErrorMonto && (
                    <div className="invalid-feedback">El monto recibido debe ser mayor o igual al total ({total.toFixed(2)}).</div>
                  )}
                </div>
              )}
              <div className="col-6">
                <label className="form-label">Estado</label>
                <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option>Pagada</option>
                  <option>Pendiente</option>
                  <option>Credito</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Observaciones</label>
                <textarea className="form-control" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            </div>
          </div></div>
        </div>
        <div className="col-md-6">
          <div className="card h-100"><div className="card-body d-flex flex-column">
            <div className="d-flex justify-content-between"><div>Subtotal</div><div className="fw-semibold">{subtotal.toFixed(2)}</div></div>
            <div className="d-flex justify-content-between align-items-center my-2">
              <div>Descuento</div>
              <div className="d-flex align-items-center gap-2">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" role="switch" id="tipoDescSwitch" checked={descuentoTipo === '%'} onChange={(e) => setDescuentoTipo(e.target.checked ? '%' : '$')} />
                  <label className="form-check-label" htmlFor="tipoDescSwitch">{descuentoTipo === '%' ? '%' : '$'}</label>
                </div>
                <input type="number" className="form-control form-control-sm" style={{ width: 140 }} min={0} value={descuentoValor}
                  onChange={(e) => setDescuentoValor(e.target.value)} />
              </div>
                <span className="text-muted small">Aplicado: ${descuento?.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="d-flex justify-content-between"><div>Impuestos</div><div className="fw-semibold">{impuestoTotal.toFixed(2)}</div></div>
            <div className="d-flex justify-content-between fs-5 mt-2"><div>Total</div><div className="fw-bold">{total.toFixed(2)}</div></div>
            {!!error && <div className="alert alert-danger mt-2 mb-0 py-2">{error}</div>}
            <div className="mt-auto d-flex gap-2 pt-2">
              <button className="btn btn-primary" disabled={finalizarDisabled} onClick={openConfirm}>{saving ? 'Procesando...' : 'Finalizar venta'}</button>
              <button className="btn btn-outline-danger" onClick={() => setItems([])}>Limpiar</button>
            </div>
          </div></div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar factura</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirm(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <div className="mb-2">
                  <strong>Cliente:</strong> {clienteSel ? `${clienteSel.Nombres} ${clienteSel.Apellidos}` : 'Consumidor final'}
                </div>
                <div className="mb-2">
                  <strong>Forma de pago:</strong> {formaPago} {formaPago === 'Efectivo' ? `(Recibido: ${Number(montoRecibido || 0).toFixed(2)})` : ''}
                </div>
                <div className="mb-2">
                  <strong>Estado:</strong> {estado}
                </div>
                {!!observaciones && (
                  <div className="mb-2"><strong>Observaciones:</strong> {observaciones}</div>
                )}
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Producto</th>
                        <th style={{ width: 140 }}>Lote</th>
                        <th style={{ width: 100 }} className="text-end">Cant.</th>
                        <th style={{ width: 120 }} className="text-end">P. Unit.</th>
                        <th style={{ width: 100 }} className="text-end">Imp.</th>
                        <th style={{ width: 120 }} className="text-end">Subtotal</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const loteSel = it.lotes.find((l) => l.loteId === it.loteId);
                        const precioMin = Number(loteSel?.precioVenta || loteSel?.precioUnitarioVenta || 0);
                        const impuesto = Number(loteSel?.impuesto || 0);
                        const unidades = Number(it.cantUnidadesMinimas || 0);
                        const sub = number(unidades * precioMin, 2);
                        const imp = number(sub * (impuesto / 100), 2);
                        return (
                          <tr key={`c-${it.productoId}-${it.loteId}`}>
                            <td>{it.nombre}<div className="text-muted small">{it.presentacion}</div></td>
                            <td>{loteSel ? (loteSel.numeroLote || `Lote ${loteSel.loteId}`) : '-'}</td>
                            <td className="text-end" style={{ width: 100 }}>
                              <input type="number" min={0} className="form-control form-control-sm text-end" value={it.cantUnidadesMinimas || 0}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                  setItems((prev) => prev.map(p => (p.productoId === it.productoId && p.loteId === it.loteId ? { ...p, cantUnidadesMinimas: v } : p)));
                                }} />
                            </td>
                            <td className="text-end">{precioMin.toFixed(2)}</td>
                            <td className="text-end">{impuesto.toFixed(2)}%</td>
                            <td className="text-end">{sub.toFixed(2)}</td>
                            <td className="text-center">
                              <button className="btn btn-sm btn-outline-danger" onClick={() => setItems(prev => prev.filter(p => !(p.productoId === it.productoId && p.loteId === it.loteId)))} title="Quitar">
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-muted">No hay productos.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Bloque de devolución */}
                <div className="border rounded p-2 mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>Devolución</strong>
                  </div>
                  {showDevolucion && (
                    <div className="row g-2 mt-2">
                      <div className="col-6">
                        <label className="form-label">Producto a devolver</label>
                        <select className="form-select" value={devSelKey} onChange={(e)=>{ setDevSelKey(e.target.value); setDevMsg(''); }}>
                          <option value="">Seleccione</option>
                          {items.map(it => (
                            <option key={`devsel-${it.productoId}-${it.loteId}`} value={`${it.productoId}|${it.loteId}`}>{it.nombre} {it.presentacion ? `· ${it.presentacion}`:''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-3">
                        <label className="form-label">Cantidad</label>
                        <input type="number" min={0} className="form-control" value={devQty} onChange={(e)=>setDevQty(e.target.value)} />
                      </div>
                      <div className="col-3 d-flex align-items-end">
                        <button className="btn btn-outline-primary w-100" onClick={() => {
                          setDevMsg('');
                          const [pidStr, loteStr] = (devSelKey||'').split('|');
                          const pid = Number(pidStr); const lid = Number(loteStr);
                          if(!pid || !lid){ setDevMsg('Seleccione un producto.'); return; }
                          const it = items.find(p => p.productoId===pid && p.loteId===lid);
                          if(!it){ setDevMsg('Producto no válido.'); return; }
                          if(!canReturnItem(it)){ setDevMsg('Este producto no permite devolución.'); return; }
                          const qty = Math.max(0, Math.floor(Number(devQty)||0));
                          if(qty<=0){ setDevMsg('Cantidad inválida.'); return; }
                          if(qty>(it.cantUnidadesMinimas||0)){ setDevMsg('Cantidad excede a la comprada.'); return; }
                          // aplicar devolución directa (reduce cantidad)
                          setItems(prev => prev.map(p => (p.productoId===pid && p.loteId===lid ? { ...p, cantUnidadesMinimas: (p.cantUnidadesMinimas||0)-qty } : p)).filter(p => (p.cantUnidadesMinimas||0)>0));
                          setDevMsg('Devolución aplicada.');
                        }}>Aplicar devolución</button>
                      </div>

                      <div className="col-12">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="chkReemp" checked={devReemp} onChange={(e)=>setDevReemp(e.target.checked)} />
                          <label className="form-check-label" htmlFor="chkReemp">Agregar reemplazo</label>
                        </div>
                      </div>
                      {devReemp && (
                        <>
                          <div className="col-7">
                            <input value={devBusca} onChange={(e)=>setDevBusca(e.target.value)} className="form-control" placeholder="Buscar producto de reemplazo..." />
                            {!!devSug.length && (
                              <div className="list-group mt-1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                                {devSug.map((p, idx) => (
                                  <button key={`sug-${p.ProductoID}`} className={`list-group-item list-group-item-action ${idx===devSugIndex ? 'active':''}`} onMouseEnter={()=>setDevSugIndex(idx)} onClick={async ()=>{
                                    setDevRep(p);
                                    try{ const lots = await getLotes({ productoId: p.ProductoID, estado: 'activos' }); setDevRepLotes(lots); setDevRepLoteId(lots[0]?.loteId||null);}catch{ setDevRepLotes([]); setDevRepLoteId(null); }
                                    setDevSug([]); setDevBusca('');
                                  }}>{p.Nombre}{p.Presentacion?` · ${p.Presentacion}`:''}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="col-3">
                            <select className="form-select" value={devRepLoteId||''} onChange={(e)=>setDevRepLoteId(Number(e.target.value)||null)}>
                              <option value="">Lote</option>
                              {devRepLotes.map(l=> <option key={`rl-${l.loteId}`} value={l.loteId}>{l.numeroLote||`Lote ${l.loteId}`}</option>)}
                            </select>
                          </div>
                          <div className="col-2">
                            <input type="number" min={0} className="form-control" placeholder="Cant." value={devRepQty} onChange={(e)=>setDevRepQty(e.target.value)} />
                          </div>
                          <div className="col-12 d-flex justify-content-end">
                            <button className="btn btn-outline-success" onClick={async ()=>{
                              setDevMsg('');
                              if(!devRep || !devRepLoteId){ setDevMsg('Seleccione producto/lote de reemplazo.'); return; }
                              const qty = Math.max(0, Math.floor(Number(devRepQty)||0));
                              if(qty<=0){ setDevMsg('Cantidad de reemplazo inválida.'); return; }
                              // agregar nuevo item de reemplazo (detalle por unidades)
                              try{
                                const lots = devRepLotes.length ? devRepLotes : await getLotes({ productoId: devRep.ProductoID, estado: 'activos' });
                                const l = lots.find(x=>x.loteId===Number(devRepLoteId));
                                if(!l){ setDevMsg('Lote no disponible.'); return; }
                                const nuevo = {
                                  productoId: devRep.ProductoID,
                                  nombre: devRep.Nombre,
                                  presentacion: devRep.Presentacion,
                                  factorUnidad: Number(devRep.CantidadUnidadMinimaXEmpaque||1),
                                  lotes: lots.map(x=>({
                                    loteId:x.loteId, numeroLote:x.numeroLote, fechaVencimiento:x.fechaVencimiento,
                                    cantidadEmpaques:x.cantidadEmpaques, cantidadUnidadesMinimas:x.cantidadUnidadesMinimas,
                                    precioUnitarioVenta:x.precioVenta, precioVenta:x.precioVenta, impuesto:x.impuesto,
                                    porcentajeImpuesto:x.impuesto, descuento:x.descuento, porcentajeDescuentoEmpaque:x.descuento,
                                  })),
                                  loteId: devRepLoteId,
                                  cantUnidadesMinimas: qty,
                                };
                                setItems(prev => [...prev, nuevo]);
                                setDevMsg('Reemplazo agregado.');
                              }catch{ setDevMsg('No fue posible agregar reemplazo.'); }
                            }}>Agregar reemplazo</button>
                          </div>
                        </>
                      )}
                      {!!devMsg && <div className="col-12"><div className="alert alert-info py-2 mb-0">{devMsg}</div></div>}
                    </div>
                  )}
                </div>
                <div className="d-flex justify-content-end">
                  <div style={{ minWidth: 260 }}>
                    <div className="d-flex justify-content-between"><div>Subtotal</div><div>{subtotal.toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between"><div>Descuento</div><div>{descuento.toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between"><div>Impuestos</div><div>{impuestoTotal.toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between fw-bold fs-6"><div>Total</div><div>{total.toFixed(2)}</div></div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Seguir editando</button>
                <button className="btn btn-outline-warning" onClick={()=> setShowDevolucion((v)=>!v)}>Devolución</button>
                <button className="btn btn-primary" disabled={!canPrint} title={canPrint?'' :'No autorizado para imprimir'} onClick={() => { setShowConfirm(false); onFinalizar(); }}>Confirmar e imprimir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aviso: venta generada, lado derecho debajo */}
      {!!ok && (
        <div className="d-flex justify-content-end mt-2">
          <div className="alert alert-success mb-0 py-2 d-flex justify-content-between align-items-center" style={{ maxWidth: 480 }}>
            <span className="me-3">Venta #{ok.ventaId} generada.</span>
            <button
              className="btn btn-sm btn-outline-success"
              onClick={async () => {
                try {
                  const { blob, filename } = await getVentaPdf(ok.ventaId);
                  const url = URL.createObjectURL(blob);
                  const win = window.open(url, '_blank');
                  if (!win) {
                    const a = document.createElement('a');
                    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
                  }
                  setTimeout(() => URL.revokeObjectURL(url), 4000);
                } catch (e) { /* ignore */ }
              }}
            >
              Imprimir factura
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
