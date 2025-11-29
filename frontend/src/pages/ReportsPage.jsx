import React, { useEffect, useMemo, useState } from 'react';
import './ReportsPage.css';
import { getHistorialDia } from '../services/salesService';
import { getInventarioResumen } from '../services/inventoryService';
import CustomButton from '../components/recursos/CustomButton';
import TabBar from '../components/TabBar';
import DataTable from 'react-data-table-component';
function ReportStatCard({ icon, colorClass, title, value, subtitle }) {
  return (
    <div className="report-stat-card card">
      <div className="card-body d-flex align-items-center gap-3">
        <div className={`report-stat-icon ${colorClass} text-white rounded-circle`}>
          <i className={`bi ${icon}`} aria-hidden="true" />
        </div>
        <div className="d-flex flex-column">
          <div className="report-stat-title text-muted fw-semibold">{title}</div>
          <div className="report-stat-value fw-bold">{value}</div>
          <div className="report-stat-sub text-muted">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

const numberFormatter = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(n, symbol = 'RD$') {
  const num = Number(n || 0);
  return `${symbol} ${numberFormatter.format(num)}`;
}

function formatNumber(n) {
  const num = Number(n || 0);
  return numberFormatter.format(num);
}

export default function ReportsPage() {
  const [tab, setTab] = useState('reportes');
  const [currencySymbol, setCurrencySymbol] = useState(() => sessionStorage.getItem('currencySymbol') || 'RD$');

  const [fechaVentas, setFechaVentas] = useState(() => new Date().toISOString().slice(0, 10));
  const [ventasData, setVentasData] = useState(null);
  const [ventasLoading, setVentasLoading] = useState(false);
  const [ventasError, setVentasError] = useState('');

  const [invData, setInvData] = useState(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');

  useEffect(() => {
    cargarVentas();
    cargarInventario();
    const storedSymbol = sessionStorage.getItem('currencySymbol');
    if (storedSymbol) setCurrencySymbol(storedSymbol);
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

  const resumenVentas = useMemo(() => ({
    total: ventasData?.totalVentas || 0,
    cantidad: ventasData?.cantidadVentas || 0,
    devoluciones: ventasData?.totalDevoluciones || 0,
  }), [ventasData]);

  const resumenInv = useMemo(() => ({
    valorCompra: invData?.metrics?.inventoryValue?.total || 0,
    valorVenta: invData?.metrics?.inventoryValue?.totalVenta || 0,
    activos: invData?.metrics?.activeProducts?.total || 0,
    bajos: invData?.metrics?.lowStock?.total || 0,
    expiran: invData?.metrics?.expiringLots?.total || 0,
  }), [invData]);

  const columnasVentas = useMemo(() => ([
    { name: 'Factura', selector: row => row.numeroFactura || '-', sortable: true, minWidth: '50px' },
    { name: 'Hora', selector: row => row.hora || '-', sortable: true, minWidth: '100px' },
    { name: 'Cliente', selector: row => row.cliente || '-', wrap: true, minWidth: '100px' },
    {
      name: 'Total',
      selector: row => row.total || 0,
      sortable: true,
      right: true,
      minWidth: '70px',
      cell: row => formatMoney(row.total || 0, currencySymbol),
    },
    { name: 'Pago', selector: row => row.metodoPago || '-', minWidth: '70px' },
    { name: 'Usuario', selector: row => row.usuario || '-', minWidth: '70px' },
  ]), [currencySymbol]);

  const columnasInventario = useMemo(() => ([
    { name: 'Producto', selector: row => row.nombre || '-', sortable: true, wrap: true, minWidth: '100px' },
    { name: 'Categoria', selector: row => row.categoria || '-', sortable: true, wrap: true, minWidth: '100px' },
    {
      id: 'stockTotal',
      name: 'Stock total',
      selector: row => row.stockTotalMinimo || 0,
      sortable: true,
      right: true,
      minWidth: '100px',
      cell: row => formatNumber(row.stockTotalMinimo || 0),
        sortFunction: (a, b) => (Number(b.stockTotalMinimo||0) - Number(a.stockTotalMinimo||0)),

    },
    {
      name: 'Minimo',
      selector: row => row.stockMinimo || 0,
      sortable: true,
      right: true,
      minWidth: '100px',
      cell: row => formatNumber(row.stockMinimo || 0),
    },
    {
      name: 'Estado',
      selector: row => row.estado || (row.activo ? 'Activo' : 'Inactivo'),
      sortable: true,
      minWidth: '100px',
      cell: row => (
        <span
          className={`inv-status-chip ${row.activo ? 'inv-status-chip-active' : 'inv-status-chip-inactive'}`}
        >
          <i className={`bi ${row.activo ? 'bi-check-circle-fill' : 'bi-x-circle'}`} aria-hidden="true" />
          {row.estado || (row.activo ? 'Activo' : 'Inactivo')}
        </span>
      ),
    },
  ]), []);

  const dataTableStyles = useMemo(() => ({
    headCells: {
      style: {
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingLeft: '5px',
        paddingRight: '5px',
      },
    },
    cells: {
      style: {
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingLeft: '5px',
        paddingRight: '5px',
      },
    },
  }), []);

  return (
    <div className="container reports-page-container py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 reports-header">
        <CustomButton
          className="btn-sm"
          onClick={() => { cargarVentas(); cargarInventario(); }}
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        </CustomButton>
        <TabBar
          tabs={[
            { value: 'reportes', label: 'Reportes', icon: 'bi bi-graph-up-arrow' },
            { value: 'avanzados', label: 'Reportes avanzados', icon: 'bi bi-stars' },
          ]}
          active={tab}
          onSelect={setTab}
          className="reports-tabbar"
          ariaLabel="Reportes menu"
        />
      </div>

      {tab === 'reportes' && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <ReportStatCard
                title="Ventas del dia"
                value={formatMoney(resumenVentas.total, currencySymbol)}
                subtitle={`Cantidad de ventas: ${resumenVentas.cantidad}`}
                icon="bi-cash-stack"
                colorClass="bg-primary"
              />
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <ReportStatCard
                title="Valor inventario"
                value={formatMoney(resumenInv.valorVenta, currencySymbol)}
                subtitle={`Costo: ${formatMoney(resumenInv.valorCompra, currencySymbol)}`}
                icon="bi-briefcase-fill"
                colorClass="bg-success"
              />
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <ReportStatCard
                title="Proximos a vencer"
                value={resumenInv.expiran}
                subtitle="Según inventario"
                icon="bi-exclamation-triangle-fill"
                colorClass="bg-warning text-dark"
              />
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <ReportStatCard
                title="Productos con stock bajo"
                value={resumenInv.bajos}
                subtitle={`Productos activos: ${resumenInv.activos}`}
                icon="bi-arrow-down-circle-fill"
                colorClass="bg-danger"
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="card report-card-ventas">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="section-chip">Ventas del dia</span>
                    <div className="d-flex align-items-end gap-2">
                      <div>
                        <input type="date" className="form-control" value={fechaVentas} onChange={(e) => setFechaVentas(e.target.value)} />
                      </div>
                      <CustomButton
                        className="btn-sm"
                        icon="bi-search"
                        text={ventasLoading ? '' : ''}
                        onClick={() => cargarVentas()}
                      />
                    </div>
                  </div>
                  {ventasError && <div className="alert alert-danger py-2">{ventasError}</div>}
                  {ventasLoading && <div className="text-muted">Cargando...</div>}
                  {!ventasLoading && !ventasError && (
                    <>
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-sm-5">
                          <div className="mini-card">
                            <div className="mini-label">Total</div>
                            <div className="mini-value">{formatMoney(resumenVentas.total, currencySymbol)}</div>
                          </div>
                        </div>
                        <div className="col-12 col-sm-3">
                          <div className="mini-card">
                            <div className="mini-label">Ventas</div>
                            <div className="mini-value">{resumenVentas.cantidad}</div>
                          </div>
                        </div>
                        <div className="col-12 col-sm-4">
                          <div className="mini-card">
                            <div className="mini-label">Devoluciones</div>
                        <div className="mini-value">{formatMoney(resumenVentas.devoluciones, currencySymbol)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="report-table-wrapper">
                        <DataTable
                          columns={columnasVentas}
                          data={ventasData?.ventas || []}
                          dense
                          highlightOnHover
                          responsive
                          fixedHeader
                          fixedHeaderScrollHeight="220px"
                          customStyles={dataTableStyles}
                          noDataComponent={<div className="text-muted py-3">Sin ventas para la fecha seleccionada.</div>}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="card report-card-inventario">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="section-chip">Inventario</span>
                    <CustomButton
                      className="btn-sm"
                      icon={invLoading ? 'bi-hourglass' : 'bi-arrow-clockwise'}
                      text={invLoading ? '' : ''}
                      onClick={cargarInventario}
                    />
                  </div>
                  {invError && <div className="alert alert-danger py-2">{invError}</div>}
                  {invLoading && <div className="text-muted">Cargando...</div>}
                  {!invLoading && !invError && (
                    <>
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-sm-6">
                          <div className="mini-card">
                            <div className="mini-label">Valor total</div>
                            <div className="mini-value">{formatMoney(resumenInv.valorVenta, currencySymbol)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="report-table-wrapper">
                        <DataTable
                          columns={columnasInventario}
                          data={invData?.products || []}
                          defaultSortFieldId="stockTotal"
                          defaultSortAsc={true}
                          dense
                          highlightOnHover
                          responsive
                          fixedHeader
                          fixedHeaderScrollHeight="220px"
                          customStyles={dataTableStyles}
                          noDataComponent={<div className="text-muted py-3">Sin datos de inventario.</div>}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </>
      )}

      {tab === 'avanzados' && (
        <div className="advanced-placeholder text-center">
          <div className="placeholder-icon">
            <i className="bi bi-tools" aria-hidden="true" />
          </div>
          <h4 className="fw-bold mb-2">En construccion</h4>
          <p className="text-muted mb-0">Funcionalidad proximamente.</p>
        </div>
      )}
    </div>
  );
}
