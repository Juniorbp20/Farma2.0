// src/pages/InventarioPage.js
import React, { useEffect, useMemo, useState } from 'react';
import './InventarioPage.css'; 
import { getProductos } from '../services/productsService';
import { getLotes, addLote, ajustarStock, getResumenInventario } from '../services/inventoryService';

export default function InventarioPage() {
  const [tab, setTab] = useState('resumen'); // resumen | lotes | ajustes
  const [productos, setProductos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [nuevoLote, setNuevoLote] = useState({ ProductoID: '', Lote: '', Vencimiento: '', Cantidad: '' });
  const [ajuste, setAjuste] = useState({ ProductoID: '', Cantidad: '', Motivo: 'Ajuste' });

  const cargarDatos = async () => {
    setLoading(true); setError(''); setOk('');
    try {
      const [prods, lotesData, resumenData] = await Promise.all([
        getProductos(),
        getLotes(),
        getResumenInventario(),
      ]);
      setProductos(prods);
      setLotes(lotesData);
      setResumen(resumenData);
    } catch (e) {
      setError('Error cargando inventario');
    } finally { setLoading(false); }
  };

  useEffect(() => { cargarDatos(); }, []);

  const productosIdx = useMemo(() => {
    const m = new Map();
    productos.forEach(p => m.set(p.ProductoID, p));
    return m;
  }, [productos]);

  const onAddLote = async (e) => {
    e.preventDefault();
    setError(''); setOk('');
    try {
      if (!nuevoLote.ProductoID) throw new Error('Seleccione producto');
      const p = productosIdx.get(Number(nuevoLote.ProductoID));
      if (!p) throw new Error('Producto inválido');
      const payload = {
        ProductoID: p.ProductoID,
        Lote: nuevoLote.Lote,
        Vencimiento: nuevoLote.Vencimiento,
        Cantidad: Number(nuevoLote.Cantidad || 0),
      };
      if (!payload.Cantidad) throw new Error('Cantidad inválida');
      await addLote(payload);
      setOk('Lote agregado');
      setNuevoLote({ ProductoID: '', Lote: '', Vencimiento: '', Cantidad: '' });
      await cargarDatos();
    } catch (err) {
      setError(typeof err?.message === 'string' ? err.message : 'Error agregando lote');
    }
  };

  const onAjustar = async (e) => {
    e.preventDefault();
    setError(''); setOk('');
    try {
      if (!ajuste.ProductoID) throw new Error('Seleccione producto');
      const p = productosIdx.get(Number(ajuste.ProductoID));
      if (!p) throw new Error('Producto inválido');
      const cantidad = Number(ajuste.Cantidad || 0);
      if (!cantidad || isNaN(cantidad)) throw new Error('Cantidad inválida');
      await ajustarStock({ ProductoID: p.ProductoID, Cantidad: cantidad, Motivo: ajuste.Motivo });
      setOk('Ajuste aplicado');
      setAjuste({ ProductoID: '', Cantidad: '', Motivo: 'Ajuste' });
      await cargarDatos();
    } catch (err) {
      setError(typeof err?.message === 'string' ? err.message : 'Error aplicando ajuste');
    }
  };

  return (
    <div className="container inventario-page-container py-3">
      <div className="d-flex align-items-center mb-3">
        <h3 className="mb-0"><i className="bi bi-box-seam me-2"></i>Inventario / Lotes</h3>
        <div className="ms-auto btn-group">
          <button className={`btn btn-outline-primary ${tab==='resumen'?'active':''}`} onClick={()=>setTab('resumen')}>Resumen</button>
          <button className={`btn btn-outline-primary ${tab==='lotes'?'active':''}`} onClick={()=>setTab('lotes')}>Lotes</button>
          <button className={`btn btn-outline-primary ${tab==='ajustes'?'active':''}`} onClick={()=>setTab('ajustes')}>Ajustes</button>
        </div>
      </div>

      {error && (<div className="alert alert-danger py-2">{error}</div>)}
      {ok && (<div className="alert alert-success py-2">{ok}</div>)}
      {loading && (<div className="alert alert-info py-2">Cargando...</div>)}

      {tab === 'resumen' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th className="text-end">Stock</th>
                    <th className="text-end">Stock mínimo</th>
                    <th className="text-end">Vencimientos ≤ 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map(r => (
                    <tr key={r.ProductoID}>
                      <td>{r.CodigoBarra}</td>
                      <td>{r.Nombre}</td>
                      <td className="text-end">{r.Stock}</td>
                      <td className="text-end">{r.StockMinimo}</td>
                      <td className="text-end">{r.VencimientosProximos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'lotes' && (
        <div className="row g-3">
          <div className="col-12 col-lg-7">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h6 className="mb-3">Lotes</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Producto</th>
                        <th>ProductoID</th>
                        <th>Lote</th>
                        <th>Vencimiento</th>
                        <th className="text-end">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotes.map(l => (
                        <tr key={l.LoteID}>
                          <td>{l.Producto || '-'}</td>
                          <td>{l.ProductoID}</td>
                          <td>{l.Lote}</td>
                          <td>{l.Vencimiento || '-'}</td>
                          <td className="text-end">{l.Cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body">
                <h6 className="mb-3">Nuevo lote</h6>
                <form onSubmit={onAddLote} className="row g-2">
                  <div className="col-12">
                    <label className="form-label">Producto</label>
                    <select className="form-select" value={nuevoLote.ProductoID} onChange={e=>setNuevoLote({...nuevoLote, ProductoID:e.target.value})} required>
                      <option value="">Seleccione...</option>
                      {productos.filter(p=>p.Activo).map(p => (
                        <option key={p.ProductoID} value={p.ProductoID}>{p.Nombre}{p.Presentacion ? ` – ${p.Presentacion}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Lote</label>
                    <input className="form-control" value={nuevoLote.Lote} onChange={e=>setNuevoLote({...nuevoLote, Lote:e.target.value})} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Vencimiento</label>
                    <input type="date" className="form-control" value={nuevoLote.Vencimiento} onChange={e=>setNuevoLote({...nuevoLote, Vencimiento:e.target.value})} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Cantidad</label>
                    <input type="number" min={1} className="form-control" value={nuevoLote.Cantidad} onChange={e=>setNuevoLote({...nuevoLote, Cantidad:e.target.value})} required />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-primary" type="submit">Agregar lote</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'ajustes' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h6 className="mb-3">Ajustes de stock</h6>
            <form onSubmit={onAjustar} className="row g-2">
              <div className="col-12 col-md-5">
                <label className="form-label">Producto</label>
                <select className="form-select" value={ajuste.ProductoID} onChange={e=>setAjuste({...ajuste, ProductoID:e.target.value})} required>
                  <option value="">Seleccione...</option>
                  {productos.filter(p=>p.Activo).map(p => (
                    <option key={p.ProductoID} value={p.ProductoID}>{p.Nombre}{p.Presentacion ? ` – ${p.Presentacion}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Cantidad (+/-)</label>
                <input type="number" step="1" className="form-control" value={ajuste.Cantidad} onChange={e=>setAjuste({...ajuste, Cantidad:e.target.value})} required />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Motivo</label>
                <input className="form-control" value={ajuste.Motivo} onChange={e=>setAjuste({...ajuste, Motivo:e.target.value})} />
              </div>
              <div className="col-12 col-md-2 d-flex align-items-end">
                <button className="btn btn-warning w-100" type="submit">Aplicar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
