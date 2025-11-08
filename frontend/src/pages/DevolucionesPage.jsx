// src/pages/DevolucionesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { getVentas, getVenta, aplicarDevolucion } from '../services/salesService';
import { getClienteById } from '../services/clientesService';

export default function DevolucionesPage({ user, onNavigate }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [facturaNo, setFacturaNo] = useState('');
  // Estado se elimina del filtro visual; la búsqueda es por No. factura
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notaCredito, setNotaCredito] = useState(null);
  const [detalle, setDetalle] = useState({ open: false, ventaId: null, cab: null, items: [], err: '', msg: '' });
  const [resumen, setResumen] = useState({ open: false, ventaId: null, cab: null, items: [], err: '' });

  const canProcess = useMemo(() => {
    const r = String(user?.rol || '').toLowerCase();
    return r.includes('admin') || r.includes('cajero');
  }, [user]);

  async function buscar() {
    // Buscar exclusivamente por número único de factura
    const id = Number(facturaNo);
    if (!Number.isFinite(id) || id <= 0) {
      setError('Ingrese un número de factura válido');
      return;
    }
    setError(''); setLoading(true);
    try {
      const data = await getVenta(id);
      const cab = data?.cabecera;
      setVentas(cab ? [cab] : []);
      if (!cab) setError('Factura no encontrada');
      // Aviso si hubo devolución (registrado localmente)
      try {
        const raw = localStorage.getItem(`DEV_FLAG_VENTA_${id}`);
        if (raw) {
          const o = JSON.parse(raw);
          const fecha = o?.ts ? new Date(o.ts).toLocaleString() : null;
          setNotaCredito(fecha ? `Se registró una devolución el ${fecha}.` : 'Se registró una devolución para esta factura.');
        } else setNotaCredito(null);
      } catch { setNotaCredito(null); }
    } catch (e) {
      setVentas([]);
      setError(e?.message || 'No se pudo obtener la factura');
      setNotaCredito(null);
    } finally { setLoading(false); }
  }

  async function abrirDetalle(v) {
    setDetalle({ open: true, ventaId: v.VentaID, cab: null, items: [], err: '', msg: '' });
    try {
      const data = await getVenta(v.VentaID);
      const items = (data.detalle || []).map((d) => ({
        productoId: d.ProductoID,
        loteId: d.LoteID,
        nombre: d.NombreProducto,
        presentacion: d.Presentacion,
        numeroLote: d.NumeroLote,
        cantidadVendida: Number(d.CantidadUnidadesMinimasVendidas || 0) + Number(d.CantidadEmpaquesVendidos || 0),
        devolver: 0,
      }));
      setDetalle({ open: true, ventaId: v.VentaID, cab: data.cabecera, items, err: '', msg: '' });
    } catch (e) {
      setDetalle((prev) => ({ ...prev, err: e.message || 'No se pudo cargar el detalle' }));
    }
  }

  async function abrirResumen(v) {
    setResumen({ open: true, ventaId: v.VentaID, cab: null, items: [], err: '' });
    try {
      const data = await getVenta(v.VentaID);
      const items = (data.detalle || []).map((d) => ({
        producto: d.NombreProducto,
        presentacion: d.Presentacion,
        numeroLote: d.NumeroLote,
        cantEmp: Number(d.CantidadEmpaquesVendidos || 0),
        cantUni: Number(d.CantidadUnidadesMinimasVendidas || 0),
        precio: Number(d.PrecioUnitario || 0),
      }));
      let cab = data.cabecera;
      if (cab?.ClienteID) {
        try {
          const cli = await getClienteById(cab.ClienteID);
          cab = { ...cab, ClienteNombre: `${cli.Nombres || ''} ${cli.Apellidos || ''}`.trim() };
        } catch {}
      }
      setResumen({ open: true, ventaId: v.VentaID, cab, items, err: '' });
    } catch (e) {
      setResumen((prev) => ({ ...prev, err: e.message || 'No se pudo cargar el resumen' }));
    }
  }

  async function confirmarDevolucion() {
    try {
      const devolver = detalle.items
        .filter(i => Number(i.devolver) > 0)
        .map(i => ({ productoId: i.productoId, loteId: i.loteId, unidades: Number(i.devolver) }));
      if (devolver.length === 0) {
        setDetalle((p) => ({ ...p, err: 'No hay cantidades a devolver' }));
        return;
      }
      await aplicarDevolucion(detalle.ventaId, { items: devolver });
      // Pre-cargar en POS los productos restantes de la factura
      try {
        const data = await getVenta(detalle.ventaId);
        const restantes = (data.detalle || []).map(d => {
          const vendidas = Number(d.CantidadUnidadesMinimasVendidas || 0) + Number(d.CantidadEmpaquesVendidos || 0);
          const dev = Number((detalle.items.find(x => x.productoId===d.ProductoID && x.loteId===d.LoteID)?.devolver) || 0);
          const rem = Math.max(0, vendidas - dev);
          return rem > 0 ? { productoId: d.ProductoID, loteId: d.LoteID, unidades: rem, nombre: d.NombreProducto, presentacion: d.Presentacion } : null;
        }).filter(Boolean);
        sessionStorage.setItem('POS_PRELOAD_RETURN', JSON.stringify({ clienteId: data?.cabecera?.ClienteID || null, items: restantes }));
        try { localStorage.setItem(`DEV_FLAG_VENTA_${detalle.ventaId}`, JSON.stringify({ ts: Date.now() })); } catch {}
      } catch { /* si falla, igual navega a POS */ }
      setDetalle((p) => ({ ...p, msg: 'Devolución aplicada', err: '' }));
      if (onNavigate) setTimeout(() => onNavigate('pos'), 300);
    } catch (e) {
      setDetalle((p) => ({ ...p, err: e.message || 'Error al aplicar devolución' }));
    }
  }

  // No buscar automáticamente al abrir la página para evitar errores de red iniciales.
  useEffect(() => { /* esperar a que el usuario pulse Buscar */ }, []);

  return (
    <div className="container py-3">
      <h1 className="page-title display-5 fw-bold text-center opacity-75 mb-3">Devoluciones</h1>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label">Desde</label>
              <input type="date" className="form-control" value={from} onChange={(e)=>setFrom(e.target.value)} />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Hasta</label>
              <input type="date" className="form-control" value={to} onChange={(e)=>setTo(e.target.value)} />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">No. factura</label>
              <input
                type="number"
                className="form-control"
                placeholder="Ej: 1005"
                value={facturaNo}
                onChange={(e)=>setFacturaNo(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==='Enter' && Number(facturaNo)>0 && !loading) buscar(); }}
              />
            </div>
            <div className="col-12 col-md-2 d-grid d-md-flex">
              <button className="btn btn-primary w-100" onClick={buscar} disabled={loading || !(Number(facturaNo)>0)}>{loading ? 'Buscando...' : 'Buscar'}</button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notaCredito && <div className="alert alert-info">{notaCredito}</div>}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="table table-sm align-middle">
              <thead className="table-light" style={{ position:'sticky', top:0 }}>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Forma pago</th>
                  <th className="text-end">Total</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.VentaID}>
                    <td>{v.VentaID}</td>
                    <td>{new Date(v.FechaVenta).toLocaleString()}</td>
                    <td>{v.ClienteID ?? '-'}</td>
                    <td>{v.Estado}</td>
                    <td>{v.FormaPago}</td>
                    <td className="text-end">{Number(v.Total||0).toFixed(2)}</td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>abrirResumen(v)}>Ver resumen</button>
                        <button className="btn btn-sm btn-outline-primary" disabled={!canProcess} title={canProcess?'':'No autorizado'} onClick={()=>abrirDetalle(v)}>Procesar devolución</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ventas.length===0 && <tr><td colSpan={7} className="text-center text-muted">Sin resultados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detalle.open && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background:'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Devolución Venta #{detalle.ventaId}</h5>
                <button type="button" className="btn-close" onClick={()=>setDetalle({ open:false, ventaId:null, cab:null, items:[], err:'', msg:'' })}></button>
              </div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                {detalle.err && <div className="alert alert-danger">{detalle.err}</div>}
                {detalle.msg && <div className="alert alert-success">{detalle.msg}</div>}
                <div className="table-responsive mb-2">
                  <table className="table table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Producto</th>
                        <th>Lote</th>
                        <th className="text-end" style={{ width:100 }}>Vend.</th>
                        <th className="text-end" style={{ width:120 }}>Devolver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.items.map((it, idx) => (
                        <tr key={`dv-${idx}`}>
                          <td>{it.nombre}<div className="text-muted small">{it.presentacion}</div></td>
                          <td>{it.numeroLote || it.loteId}</td>
                          <td className="text-end">{Number(it.cantidadVendida||0)}</td>
                          <td className="text-end"><input type="number" min={0} max={Number(it.cantidadVendida||0)} className="form-control form-control-sm text-end" value={it.devolver} onChange={(e)=>{
                            const v = Math.max(0, Math.min(Number(e.target.value||0), Number(it.cantidadVendida||0)));
                            setDetalle((prev)=> ({ ...prev, items: prev.items.map((x,i)=> i===idx ? { ...x, devolver: v } : x) }));
                          }} /></td>
                        </tr>
                      ))}
                      {detalle.items.length===0 && <tr><td colSpan={4} className="text-center text-muted">Sin detalle</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setDetalle({ open:false, ventaId:null, cab:null, items:[], err:'', msg:'' })}>Cerrar</button>
                <button className="btn btn-primary" disabled={!canProcess} onClick={confirmarDevolucion}>Aplicar devolución</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resumen.open && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background:'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title w-100 text-center">Resumen factura #{resumen.ventaId}</h5>
                <button type="button" className="btn-close" onClick={()=>setResumen({ open:false, ventaId:null, cab:null, items:[], err:'' })}></button>
              </div>
              <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
                {resumen.err && <div className="alert alert-danger">{resumen.err}</div>}
                {/* Aviso si hubo devolucin previa registrada localmente */}
                {(() => { try { return !!localStorage.getItem(`DEV_FLAG_VENTA_${resumen.ventaId}`); } catch { return false; } })() && (
                  <div className="alert alert-info py-2">Esta factura tiene una devolución registrada.</div>
                )}
                <div className="mb-2"><strong>Fecha:</strong> {resumen.cab ? new Date(resumen.cab.FechaVenta).toLocaleString() : '-'}</div>
                <div className="mb-2"><strong>Cliente:</strong> {resumen.cab?.ClienteNombre || (resumen.cab?.ClienteID ?? '-')}</div>
                <div className="mb-2"><strong>Forma de pago:</strong> {resumen.cab?.FormaPago ?? '-'}</div>
                <div className="mb-2"><strong>Estado:</strong> {resumen.cab?.Estado ?? '-'}</div>
                {!!resumen.cab?.Observaciones && <div className="mb-2"><strong>Observaciones:</strong> {resumen.cab.Observaciones}</div>}

                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Producto</th>
                        <th>Lote</th>
                        <th style={{ width:120 }}>Modo</th>
                        <th className="text-end" style={{ width:100 }}>Unid.</th>
                        <th className="text-end" style={{ width:120 }}>P. Unit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.items.map((it, idx) => (
                        <tr key={`rs-${idx}`}>
                          <td>{it.producto}<div className="text-muted small">{it.presentacion}</div></td>
                          <td>{it.numeroLote || '-'}</td>
                          <td>{it.cantEmp > 0 ? `Empaque x${it.cantEmp}` : `Detalle`}</td>
                          <td className="text-end">{it.cantUni}</td>
                          <td className="text-end">{it.precio.toFixed(2)}</td>
                        </tr>
                      ))}
                      {resumen.items.length===0 && <tr><td colSpan={4} className="text-center text-muted">Sin detalle</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-end">
                  <div style={{ minWidth: 260 }}>
                    <div className="d-flex justify-content-between"><div>Subtotal</div><div>{Number(resumen.cab?.Subtotal||0).toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between"><div>Descuento</div><div>{Number(resumen.cab?.DescuentoTotal||0).toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between"><div>Impuestos</div><div>{Number(resumen.cab?.ImpuestoTotal||0).toFixed(2)}</div></div>
                    <div className="d-flex justify-content-between fw-bold fs-6"><div>Total</div><div>{Number(resumen.cab?.Total||0).toFixed(2)}</div></div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setResumen({ open:false, ventaId:null, cab:null, items:[], err:'' })}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




