import React, { useEffect, useMemo, useState } from 'react';
import './ReportsPage.css';
import { getHistorialDia } from '../services/salesService';
import { getInventarioResumen, getLotes } from '../services/inventoryService';

function formatMoney(n) {
  return `RD$ ${Number(n || 0).toFixed(2)}`;
}

export default function ReportsPage() {
  const [fechaVentas, setFechaVentas] = useState(() => new Date().toISOString().slice(0, 10));
  const [ventasData, setVentasData] = useState(null);
  const [ventasLoading, setVentasLoading] = useState(false);
  const [ventasError, setVentasError] = useState('');

  const [invData, setInvData] = useState(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');

  const [vencimientos, setVencimientos] = useState([]);
  const [vencLoading, setVencLoading] = useState(false);
  const [vencError, setVencError] = useState('');
  const [vencDias, setVencDias] = useState(60);

  useEffect(() => {
    cargarVentas();
    cargarInventario();
    cargarVencimientos();
  }, []);

  async function cargarVentas(fechaParam) {
    const fecha = fechaParam || fechaVentas;
    setVentasError('');
    setVentasLoading(true);
    try {
      const data = await getHistorialDia(fecha);
      setVentasData(data || null);
    } catch (e) {
      setVentasData(null);
      setVentasError(e?.message || 'No se pudo cargar ventas');
    } finally {
      setVentasLoading(false);
    }
  }

  async function cargarInventario() {
    setInvError('');
    setInvLoading(true);
    try {
      const data = await getInventarioResumen();
      setInvData(data || null);
    } catch (e) {
      setInvData(null);
      setInvError(e?.message || 'No se pudo cargar inventario');
    } finally {
      setInvLoading(false);
    }
  }

  async function cargarVencimientos() {
    setVencError('');
    setVencLoading(true);
    try {
      const dias = Number(vencDias);
      const data = await getLotes({ proximos: true, diasMax: Number.isFinite(dias) ? dias : 60, estado: 'activos' });
      const list = Array.isArray(data) ? data.slice(0, 10) : [];
      setVencimientos(list);
    } catch (e) {
      setVencimientos([]);
      setVencError(e?.message || 'No se pudo cargar vencimientos');
    } finally {
      setVencLoading(false);
    }
  }

  const resumenVentas = useMemo(() => ({
    total: ventasData?.totalVentas || 0,
    cantidad: ventasData?.cantidadVentas || 0,
    devoluciones: ventasData?.totalDevoluciones || 0,
  }), [ventasData]);

  const resumenInv = useMemo(() => ({
    valor: invData?.summary?.inventoryValue?.total || 0,
    activos: invData?.summary?.activeProducts?.total || 0,
    bajos: invData?.summary?.lowStock?.total || 0,
    expiran: invData?.summary?.expiringLots?.total || 0,
  }), [invData]);

  return (
    <div className="container reports-page-container py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <div className="badge bg-light text-primary mb-1">Panel de reportes</div>
          <h2 className="fw-bold mb-0">Reportes</h2>
          <div className="text-muted">Ventas, inventario y vencimientos en un vistazo.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary" onClick={() => { cargarVentas(); cargarInventario(); cargarVencimientos(); }}>
            <i className="bi bi-arrow-clockwise me-1" /> Refrescar todo
          </button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="report-chip bg-primary text-white">
            <div className="label">Ventas del dia</div>
            <div className="value">{formatMoney(resumenVentas.total)}</div>
            <div className="small">Cant: {resumenVentas.cantidad}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="report-chip bg-success text-white">
            <div className="label">Valor inventario</div>
            <div className="value">{formatMoney(resumenInv.valor)}</div>
            <div className="small">Activos: {resumenInv.activos}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="report-chip bg-warning text-dark">
            <div className="label">Prontos a vencer</div>
            <div className="value">{resumenInv.expiran}</div>
            <div className="small">{`<= ${vencDias} dias`}</div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="report-chip bg-danger text-white">
            <div className="label">Bajo stock</div>
            <div className="value">{resumenInv.bajos}</div>
            <div className="small">Productos bajo minimo</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">Ventas del dia</h5>
                <div className="d-flex align-items-end gap-2">
                  <div>
                    <label className="form-label mb-1 small text-muted">Fecha</label>
                    <input type="date" className="form-control" value={fechaVentas} onChange={(e) => setFechaVentas(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={() => cargarVentas()}>
                    {ventasLoading ? 'Cargando...' : 'Buscar'}
                  </button>
                </div>
              </div>
              {ventasError && <div className="alert alert-danger py-2">{ventasError}</div>}
              {ventasLoading && <div className="text-muted">Cargando...</div>}
              {!ventasLoading && !ventasError && (
                <>
                  <div className="d-flex gap-3 flex-wrap mb-3">
                    <div className="mini-card">
                      <div className="mini-label">Total</div>
                      <div className="mini-value">{formatMoney(resumenVentas.total)}</div>
                    </div>
                    <div className="mini-card">
                      <div className="mini-label">Ventas</div>
                      <div className="mini-value">{resumenVentas.cantidad}</div>
                    </div>
                    <div className="mini-card">
                      <div className="mini-label">Devoluciones</div>
                      <div className="mini-value text-warning">{formatMoney(resumenVentas.devoluciones)}</div>
                    </div>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: 260 }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Factura</th>
                          <th>Hora</th>
                          <th>Cliente</th>
                          <th className="text-end">Total</th>
                          <th>Pago</th>
                          <th>Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ventasData?.ventas || []).map((v, idx) => (
                          <tr key={`rv-${v.numeroFactura || idx}`}>
                            <td>{v.numeroFactura || '-'}</td>
                            <td>{v.hora || '-'}</td>
                            <td>{v.cliente || '-'}</td>
                            <td className="text-end">{formatMoney(v.total || 0)}</td>
                            <td>{v.metodoPago || '-'}</td>
                            <td>{v.usuario || '-'}</td>
                          </tr>
                        ))}
                        {(ventasData?.ventas || []).length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted">Sin ventas para la fecha seleccionada.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Inventario</h5>
                <button className="btn btn-outline-primary btn-sm" onClick={cargarInventario}>Actualizar</button>
              </div>
              {invError && <div className="alert alert-danger py-2">{invError}</div>}
              {invLoading && <div className="text-muted">Cargando...</div>}
              {!invLoading && !invError && (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-sm-6">
                      <div className="mini-card">
                        <div className="mini-label">Valor total</div>
                        <div className="mini-value">{formatMoney(resumenInv.valor)}</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="mini-card">
                        <div className="mini-label">Productos activos</div>
                        <div className="mini-value">{resumenInv.activos}</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="mini-card">
                        <div className="mini-label">Bajo stock</div>
                        <div className="mini-value text-danger">{resumenInv.bajos}</div>
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: 220 }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Producto</th>
                          <th>Categoria</th>
                          <th className="text-end">Stock total</th>
                          <th className="text-end">Minimo</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invData?.products || []).slice(0, 8).map((p) => (
                          <tr key={`inv-${p.productoId}`}>
                            <td>{p.nombre}</td>
                            <td>{p.categoria || '-'}</td>
                            <td className="text-end">{Number(p.stockTotalMinimo || 0)}</td>
                            <td className="text-end">{Number(p.stockMinimo || 0)}</td>
                            <td>
                              <span className={`badge ${p.activo ? 'bg-success-subtle text-success' : 'bg-secondary'}`}>
                                {p.estado || (p.activo ? 'Activo' : 'Inactivo')}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(invData?.products || []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center text-muted">Sin datos de inventario.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <h5 className="mb-0">Lotes prontos a vencer</h5>
                  <div className="text-muted small">{`Proximos ${vencDias} dias`}</div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="number"
                    min={15}
                    max={120}
                    className="form-control"
                    style={{ width: 110 }}
                    value={vencDias}
                    onChange={(e) => setVencDias(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') cargarVencimientos(); }}
                  />
                  <button className="btn btn-outline-primary" onClick={cargarVencimientos}>
                    {vencLoading ? 'Cargando...' : 'Actualizar'}
                  </button>
                </div>
              </div>
              {vencError && <div className="alert alert-danger py-2">{vencError}</div>}
              {vencLoading && <div className="text-muted">Cargando...</div>}
              {!vencLoading && !vencError && (
                <div className="table-responsive" style={{ maxHeight: 260 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Producto</th>
                        <th>Lote</th>
                        <th>Vence</th>
                        <th className="text-end">Cant. empaques</th>
                        <th>Dias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vencimientos.map((l, idx) => (
                        <tr key={`v-${l.loteId || idx}`}>
                          <td>{l.nombreProducto || l.productoNombre || l.nombre || '-'}</td>
                          <td>{l.numeroLote || l.loteId || '-'}</td>
                          <td>{l.fechaVencimiento ? new Date(l.fechaVencimiento).toLocaleDateString() : '-'}</td>
                          <td className="text-end">{Number(l.cantidadEmpaques ?? l.cantidad ?? 0)}</td>
                          <td>
                            <span className={`badge ${Number(l.diasRestantes) <= 30 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                              {l.diasRestantes ?? '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {vencimientos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">No hay lotes proximos a vencer.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
