import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './InventarioPage.css';
import StatsCard from '../components/StatsCard';
import ProductSelector from '../components/ProductSelector';
import ExportMenuButton, { EXPORT_MENU_DEFAULT_OPTIONS } from '../components/recursos/ExportMenuButton';
import DataTable from 'react-data-table-component';
import {
  getInventarioResumen,
  getLotes,
  getLoteDetalle,
  updateLote,
  deactivateLote,
  getCompras,
  getCompra,
  createCompra,
  exportCompras,
} from '../services/inventoryService';
import { getProveedores } from '../services/proveedoresService';
import { getUser } from '../services/authService';

const currencyFormatter = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const numberFormatter = new Intl.NumberFormat('es-PE');

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
const formatNumber = (value) => numberFormatter.format(Number(value || 0));
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const defaultLoteFilters = {
  buscar: '',
  estado: 'activos',
  proximos: false,
};

const createEmptyCompraItem = (index) => ({
  id: `item-${Date.now()}-${index}`,
  productoId: null,
  producto: null,
  lotesDisponibles: [],
  loteSeleccion: 'nuevo',
  loteId: '',
  numeroLote: '',
  fechaVencimiento: '',
  precioCosto: '',
  precioVenta: '',
  impuesto: 0,
  descuento: 0,
  cantidadEmpaques: '',
  cantidadUnidadesMinimas: '',
});

function FieldError({ error }) {
  if (!error) return null;
  return <div className="text-danger small mt-1">{error}</div>;
}

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState('resumen');

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const [cardModal, setCardModal] = useState({ type: null });
  const [productLotsModal, setProductLotsModal] = useState({ open: false, product: null, loading: false, error: '', lots: [] });

  const [loteFilters, setLoteFilters] = useState(defaultLoteFilters);
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [lotesError, setLotesError] = useState('');

  const [loteModal, setLoteModal] = useState({ open: false, mode: 'view', loteId: null, loading: false, data: null, error: '' });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, lote: null, motivo: '', loading: false, error: '' });

  const [compras, setCompras] = useState([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [comprasError, setComprasError] = useState('');
  const [comprasPage, setComprasPage] = useState(1);
  const [comprasPageSize, setComprasPageSize] = useState(10);
  const [comprasTotal, setComprasTotal] = useState(0);
  const [comprasExporting, setComprasExporting] = useState(null);
  const [comprasExportFormats, setComprasExportFormats] = useState({ excel: true, pdf: false });
  const [comprasPaginationReset, setComprasPaginationReset] = useState(false);
  const [compraModal, setCompraModal] = useState({ open: false, compraId: null, loading: false, data: null, error: '' });

  const [proveedores, setProveedores] = useState([]);
  const [proveedoresLoading, setProveedoresLoading] = useState(false);
  const [proveedoresError, setProveedoresError] = useState('');

  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([createEmptyCompraItem(0)]);
  const [purchaseErrors, setPurchaseErrors] = useState('');
  const [creatingCompra, setCreatingCompra] = useState(false);
  const [createCompraOk, setCreateCompraOk] = useState('');

  const [productSearch, setProductSearch] = useState('');

  const comprasExportOptions = useMemo(
    () =>
      EXPORT_MENU_DEFAULT_OPTIONS.filter((option) => {
        if (option.value === 'excel') return !!comprasExportFormats.excel;
        if (option.value === 'pdf') return !!comprasExportFormats.pdf;
        return true;
      }),
    [comprasExportFormats]
  );

  const comprasExportButtonDisabled = comprasExportOptions.length === 0;

  const user = useMemo(() => getUser(), []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const data = await getInventarioResumen();
      setDashboard(data);
    } catch (err) {
      setDashboardError(err.message || 'No se pudo obtener el resumen.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadLotes = useCallback(async (filters) => {
    const targetFilters = filters || loteFilters;
    setLotesLoading(true);
    setLotesError('');
    try {
      const params = {
        buscar: targetFilters.buscar,
        estado: targetFilters.estado,
      };
      if (targetFilters.proximos) params.proximos = true;
      const data = await getLotes(params);
      setLotes(data);
    } catch (err) {
      setLotesError(err.message || 'No se pudo obtener la lista de lotes.');
    } finally {
      setLotesLoading(false);
    }
  }, [loteFilters]);

  const loadCompras = useCallback(
    async (pageOverride, pageSizeOverride) => {
      const parsedPage = Number(pageOverride);
      const parsedPageSize = Number(pageSizeOverride);
      const targetPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : comprasPage;
      const targetPageSize =
        Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : comprasPageSize;
      const safePage = Math.max(1, targetPage);
      const safePageSize = Math.max(1, targetPageSize);

      setComprasLoading(true);
      setComprasError('');
      try {
        const response = await getCompras({ page: safePage, pageSize: safePageSize });
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];
        setCompras(items);

        const pagination = response?.pagination || {};

        const total =
          pagination.total != null && Number.isFinite(Number(pagination.total))
            ? Number(pagination.total)
            : items.length;
        if (total !== comprasTotal) setComprasTotal(total);

        if (response?.exports) {
          const nextFormats = {
            excel: Boolean(response.exports.excel),
            pdf: Boolean(response.exports.pdf),
          };
          setComprasExportFormats((prev) =>
            prev.excel === nextFormats.excel && prev.pdf === nextFormats.pdf ? prev : nextFormats
          );
        }

        const responsePage =
          pagination.page != null && Number.isFinite(Number(pagination.page))
            ? Math.max(1, Number(pagination.page))
            : safePage;
        if (responsePage !== comprasPage) {
          setComprasPage(responsePage);
          setComprasPaginationReset((prev) => !prev);
        }

        const responsePageSize =
          pagination.pageSize != null && Number.isFinite(Number(pagination.pageSize))
            ? Math.max(1, Number(pagination.pageSize))
            : safePageSize;
        if (responsePageSize !== comprasPageSize) setComprasPageSize(responsePageSize);
      } catch (err) {
        setCompras([]);
        setComprasError(err.message || 'No se pudo obtener la lista de compras.');
        if (comprasTotal !== 0) setComprasTotal(0);
      } finally {
        setComprasLoading(false);
      }
    },
    [comprasPage, comprasPageSize, comprasTotal]
  );

  const handleComprasPageChange = (newPage) => {
    const parsed = Number(newPage);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const normalized = Math.floor(parsed);
    if (normalized === comprasPage) return;
    setComprasPage(normalized);
  };

  const handleComprasPageSizeChange = (newSize) => {
    const parsed = Number(newSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const normalized = Math.floor(parsed);
    if (normalized === comprasPageSize) return;
    setComprasPageSize(normalized);
    setComprasPage(1);
    setComprasPaginationReset((prev) => !prev);
  };

  const handleExportCompras = async (format) => {
    if (!format) return;
    setComprasError('');
    setComprasExporting(format);
    try {
      const { blob, filename } = await exportCompras(format, {
        page: comprasPage,
        pageSize: comprasPageSize,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setComprasError(err.message || 'No se pudo exportar el historial de compras.');
    } finally {
      setComprasExporting(null);
    }
  };

  const loadProveedores = useCallback(async () => {
    setProveedoresLoading(true);
    setProveedoresError('');
    try {
      const data = await getProveedores();
      setProveedores(data);
    } catch (err) {
      setProveedoresError(err.message || 'No se pudo obtener proveedores.');
    } finally {
      setProveedoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'resumen') loadDashboard();
    if (activeTab === 'lotes') loadLotes();
    if (activeTab === 'compras') {
      loadCompras(comprasPage, comprasPageSize);
      if (!proveedores.length) loadProveedores();
    }
  }, [
    activeTab,
    comprasPage,
    comprasPageSize,
    proveedores.length,
    loadDashboard,
    loadLotes,
    loadCompras,
    loadProveedores,
  ]);

  const handleChangeTab = (tab) => setActiveTab(tab);

  const openCardModal = (type) => setCardModal({ type });
  const closeCardModal = () => setCardModal({ type: null });

  const handleOpenProductLotsModal = useCallback(async (product) => {
    setProductLotsModal({ open: true, product, loading: true, error: '', lots: [] });
    try {
      const data = await getLotes({ productoId: product.productoId, estado: 'activos' });
      setProductLotsModal((prev) => ({ ...prev, loading: false, lots: data }));
    } catch (err) {
      setProductLotsModal((prev) => ({ ...prev, loading: false, error: err.message || 'No se pudieron obtener los lotes.' }));
    }
  }, []);

  const closeProductLotsModal = () => setProductLotsModal({ open: false, product: null, loading: false, error: '', lots: [] });

  const openLoteModal = async (mode, lote) => {
    setLoteModal({ open: true, mode, loteId: lote.loteId, loading: true, data: null, error: '' });
    try {
      const detail = await getLoteDetalle(lote.loteId);
      setLoteModal((prev) => ({ ...prev, loading: false, data: detail }));
    } catch (err) {
      setLoteModal((prev) => ({ ...prev, loading: false, error: err.message || 'No se pudo obtener el detalle.' }));
    }
  };

  const closeLoteModal = () => setLoteModal({ open: false, mode: 'view', loteId: null, loading: false, data: null, error: '' });

  const saveLoteChanges = async () => {
    if (!loteModal?.data?.loteId) return;
    setLoteModal((prev) => ({ ...prev, loading: true, error: '' }));
    const payload = {
      NumeroLote: loteModal.data.numeroLote,
      FechaVencimiento: loteModal.data.fechaVencimiento,
      PrecioCosto: Number(loteModal.data.precioCosto),
      PrecioVenta: Number(loteModal.data.precioVenta),
      Impuesto: Number(loteModal.data.impuesto),
      Descuento: Number(loteModal.data.descuento),
    };
    try {
      await updateLote(loteModal.data.loteId, payload);
      closeLoteModal();
      loadLotes();
      if (activeTab === 'resumen') loadDashboard();
    } catch (err) {
      setLoteModal((prev) => ({ ...prev, loading: false, error: err.message || 'Error al actualizar lote.' }));
    }
  };

  const openDeactivateModal = (lote) => {
    setDeactivateModal({ open: true, lote, motivo: '', loading: false, error: '' });
  };

  const closeDeactivateModal = () => setDeactivateModal({ open: false, lote: null, motivo: '', loading: false, error: '' });

  const confirmDeactivate = async () => {
    if (!deactivateModal.lote) return;
    setDeactivateModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await deactivateLote(deactivateModal.lote.loteId, deactivateModal.motivo?.trim());
      closeDeactivateModal();
      loadLotes();
      if (activeTab === 'resumen') loadDashboard();
    } catch (err) {
      setDeactivateModal((prev) => ({ ...prev, loading: false, error: err.message || 'No se pudo desactivar el lote.' }));
    }
  };

  const handleChangeFilters = (field, value) => {
    const updated = { ...loteFilters, [field]: value };
    setLoteFilters(updated);
    loadLotes(updated);
  };

  const handleSelectCompra = useCallback(async (compraId) => {
    setCompraModal({ open: true, compraId, loading: true, data: null, error: '' });
    try {
      const data = await getCompra(compraId);
      setCompraModal((prev) => ({ ...prev, loading: false, data }));
    } catch (err) {
      setCompraModal((prev) => ({ ...prev, loading: false, error: err.message || 'No se pudo obtener la compra.' }));
    }
  }, []);

  const comprasColumns = useMemo(
    () => [
      {
        name: 'Fecha',
        selector: (row) => row.fechaOrden,
        cell: (row) => formatDate(row.fechaOrden),
        minWidth: '110px',
      },
      {
        name: 'Proveedor',
        selector: (row) => row.proveedor,
        cell: (row) => row.proveedor || 'Sin proveedor',
        wrap: true,
        minWidth: '200px',
      },
      {
        name: 'Total',
        selector: (row) => row.total,
        cell: (row) => formatCurrency(row.total),
        right: true,
        minWidth: '110px',
      },
      {
        name: 'Items',
        selector: (row) => row.items,
        cell: (row) => formatNumber(row.items),
        right: true,
        maxWidth: '90px',
      },
      {
        name: '',
        allowOverflow: true,
        button: true,
        right: true,
        minWidth: '110px',
        cell: (row) => (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleSelectCompra(row.ordenCompraId)}
          >
            Detalle
          </button>
        ),
      },
    ],
    [handleSelectCompra]
  );

  const closeCompraModal = () => setCompraModal({ open: false, compraId: null, loading: false, data: null, error: '' });

  const handleAddCompraItem = () => {
    setPurchaseItems((prev) => [...prev, createEmptyCompraItem(prev.length)]);
  };

  const handleRemoveCompraItem = (id) => {
    setPurchaseItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const updateCompraItem = (id, updater) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...(typeof updater === 'function' ? updater(item) : updater) } : item))
    );
  };

  const handleSelectProducto = async (id, producto) => {
    updateCompraItem(id, {
      productoId: producto.ProductoID,
      producto,
      lotesDisponibles: [],
      loteSeleccion: 'nuevo',
      loteId: '',
      numeroLote: '',
      fechaVencimiento: '',
      precioCosto: producto.PrecioCosto ?? '',
      precioVenta: producto.PrecioVenta ?? '',
      impuesto: 0,
      descuento: 0,
      cantidadEmpaques: '',
      cantidadUnidadesMinimas: '',
    });
    try {
      const lotesProducto = await getLotes({ productoId: producto.ProductoID, estado: 'activos' });
      updateCompraItem(id, { lotesDisponibles: lotesProducto });
    } catch (err) {
      console.error('No se pudieron cargar lotes del producto', err);
    }
  };

  const handleSelectLoteExistente = (id, loteId) => {
    updateCompraItem(id, (prevItem) => {
      const lote = prevItem.lotesDisponibles.find((l) => l.loteId === Number(loteId));
      if (!lote) {
        return {
          loteSeleccion: 'nuevo',
          loteId: '',
          numeroLote: '',
          fechaVencimiento: '',
        };
      }
      return {
        loteSeleccion: 'existente',
        loteId: lote.loteId,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento || '',
        precioCosto: lote.precioCosto,
        precioVenta: lote.precioVenta,
        impuesto: lote.impuesto,
        descuento: lote.descuento,
      };
    });
  };

  const handleSubmitCompra = async (event) => {
    event.preventDefault();
    setPurchaseErrors('');
    setCreateCompraOk('');

    if (!selectedProveedor) {
      setPurchaseErrors('Seleccione un proveedor.');
      return;
    }

    const itemsPayload = [];
    for (const item of purchaseItems) {
      if (!item.productoId) {
        setPurchaseErrors('Cada item debe tener un producto seleccionado.');
        return;
      }
      const isNuevo = item.loteSeleccion !== 'existente' || !item.loteId;
      if (isNuevo && !item.numeroLote) {
        setPurchaseErrors('Complete los datos de lote para cada producto.');
        return;
      }
      itemsPayload.push({
        productoId: item.productoId,
        loteId: isNuevo ? null : Number(item.loteId),
        crearNuevoLote: isNuevo,
        numeroLote: item.numeroLote,
        fechaVencimiento: item.fechaVencimiento,
        precioCosto: Number(item.precioCosto),
        precioVenta: Number(item.precioVenta),
        impuesto: Number(item.impuesto),
        descuento: Number(item.descuento),
        cantidadEmpaques: Number(item.cantidadEmpaques || 0),
        cantidadUnidadesMinimas: Number(item.cantidadUnidadesMinimas || 0),
      });
    }

    setCreatingCompra(true);
    try {
      const payload = {
        proveedorId: Number(selectedProveedor),
        items: itemsPayload,
      };
      await createCompra(payload);
      setCreateCompraOk('Compra registrada correctamente.');
      setPurchaseItems([createEmptyCompraItem(0)]);
      setSelectedProveedor('');
      if (comprasPage !== 1) setComprasPage(1);
      setComprasPaginationReset((prev) => !prev);
      await loadCompras(1, comprasPageSize);
      loadDashboard();
      loadLotes();
    } catch (err) {
      setPurchaseErrors(err.message || 'No se pudo registrar la compra.');
    } finally {
      setCreatingCompra(false);
    }
  };

  const renderCardModal = () => {
    if (!cardModal.type || !dashboard) return null;
    let title = '';
    let rows = [];
    if (cardModal.type === 'valor') {
      title = 'Detalle del valor de inventario';
      rows = dashboard.lists?.inventoryValue || [];
    } else if (cardModal.type === 'vencimientos') {
      title = 'Próximos a vencer';
      rows = dashboard.lists?.expiringLots || [];
    } else if (cardModal.type === 'bajoStock') {
      title = 'Productos con stock bajo';
      rows = dashboard.lists?.lowStock || [];
    } else if (cardModal.type === 'activos') {
      title = 'Productos activos';
      rows = dashboard.lists?.activeProducts || [];
    }

    return (
      <div className="inventory-modal-backdrop" onClick={closeCardModal}>
        <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <h5>{title}</h5>
            <button className="btn-close" onClick={closeCardModal}></button>
          </div>
          <div className="inventory-modal-body">
            {rows.length === 0 ? (
              <p className="text-muted mb-0">Sin datos disponibles.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Detalle</th>
                      <th className="text-end">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.productoId || row.loteId || ''}-${row.numeroLote || ''}`}>
                        <td>
                          <div className="fw-semibold">{row.producto || row.nombre || '—'}</div>
                          {row.categoria && <div className="text-muted small">{row.categoria}</div>}
                        </td>
                        <td>
                          {cardModal.type === 'valor' && (
                            <>
                              <div>Lote: {row.numeroLote || '—'}</div>
                              <div>{formatNumber(row.cantidadTotalMinima)} unidades totales</div>
                              {row.fechaVencimiento && <div>Vence: {formatDate(row.fechaVencimiento)}</div>}
                            </>
                          )}
                          {cardModal.type === 'vencimientos' && (
                            <>
                              <div>Lote: {row.numeroLote || '—'}</div>
                              <div>Vence en {formatNumber(row.diasRestantes)} días</div>
                            </>
                          )}
                          {cardModal.type === 'bajoStock' && (
                            <>
                              <div>Stock actual: {formatNumber(row.stockActual)}</div>
                              <div>Mínimo: {formatNumber(row.stockMinimo)}</div>
                              <div>Faltante: {formatNumber(row.deficit)}</div>
                            </>
                          )}
                          {cardModal.type === 'activos' && (
                            <>
                              <div>Stock total: {formatNumber(row.stockTotalMinimo)}</div>
                              <div>Mínimo: {formatNumber(row.stockMinimo)}</div>
                            </>
                          )}
                        </td>
                        <td className="text-end">
                          {cardModal.type === 'valor' ? formatCurrency(row.valorTotal) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProductLotsModal = () => {
    if (!productLotsModal.open) return null;
    const { product, lots, loading, error } = productLotsModal;
    return (
      <div className="inventory-modal-backdrop" onClick={closeProductLotsModal}>
        <div className="inventory-modal inventory-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <h5>Lotes del producto {product?.nombre}</h5>
            <button className="btn-close" onClick={closeProductLotsModal}></button>
          </div>
          <div className="inventory-modal-body">
            {loading && <p>Cargando lotes...</p>}
            {error && <div className="alert alert-warning">{error}</div>}
            {!loading && !error && lots.length === 0 && <p className="text-muted mb-0">Sin lotes activos para este producto.</p>}
            {!loading && !error && lots.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th className="text-end">Stock (unidades)</th>
                      <th className="text-end">Precio costo</th>
                      <th className="text-end">Precio venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lote) => (
                      <tr key={lote.loteId}>
                        <td>{lote.numeroLote}</td>
                        <td>{formatDate(lote.fechaVencimiento)}</td>
                        <td className="text-end">{formatNumber(lote.cantidadTotalMinima)}</td>
                        <td className="text-end">{formatCurrency(lote.precioCosto)}</td>
                        <td className="text-end">{formatCurrency(lote.precioVenta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLoteModal = () => {
    if (!loteModal.open) return null;
    const { mode, loading, data, error } = loteModal;
    const editable = mode === 'edit';

    const updateLocalField = (field, value) => {
      setLoteModal((prev) => ({
        ...prev,
        data: { ...prev.data, [field]: value },
      }));
    };

    return (
      <div className="inventory-modal-backdrop" onClick={closeLoteModal}>
        <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <h5>{editable ? 'Editar lote' : 'Detalle del lote'}</h5>
            <button className="btn-close" onClick={closeLoteModal}></button>
          </div>
          <div className="inventory-modal-body">
            {loading && <p>Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}
            {data && !loading && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editable) saveLoteChanges();
                }}
              >
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Producto</label>
                    <div className="form-control-plaintext">{data.producto}</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Número de lote</label>
                    {editable ? (
                      <input
                        className="form-control"
                        value={data.numeroLote || ''}
                        onChange={(e) => updateLocalField('numeroLote', e.target.value)}
                        required
                      />
                    ) : (
                      <div className="form-control-plaintext">{data.numeroLote || '—'}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Fecha de vencimiento</label>
                    {editable ? (
                      <input
                        type="date"
                        className="form-control"
                        value={data.fechaVencimiento ? data.fechaVencimiento.slice(0, 10) : ''}
                        onChange={(e) => updateLocalField('fechaVencimiento', e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">{formatDate(data.fechaVencimiento)}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Precio costo</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.precioCosto ?? ''}
                        onChange={(e) => updateLocalField('precioCosto', e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">{formatCurrency(data.precioCosto)}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Precio venta</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.precioVenta ?? ''}
                        onChange={(e) => updateLocalField('precioVenta', e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">{formatCurrency(data.precioVenta)}</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Impuesto (%)</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.impuesto ?? 0}
                        onChange={(e) => updateLocalField('impuesto', e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">{formatNumber(data.impuesto ?? 0)}%</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Descuento (%)</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.descuento ?? 0}
                        onChange={(e) => updateLocalField('descuento', e.target.value)}
                      />
                    ) : (
                      <div className="form-control-plaintext">{formatNumber(data.descuento ?? 0)}%</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Stock disponible (unidades)</label>
                    <div className="form-control-plaintext">{formatNumber(data.cantidadTotalMinima)}</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Estado</label>
                    <div className="form-control-plaintext">{data.activo ? 'Activo' : 'Inactivo'}</div>
                  </div>
                  {data.motivoInactivacion && (
                    <div className="col-12">
                      <label className="form-label">Motivo de inactivación</label>
                      <div className="form-control-plaintext">{data.motivoInactivacion}</div>
                    </div>
                  )}
                </div>
                {editable && (
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeLoteModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      Guardar cambios
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDeactivateModal = () => {
    if (!deactivateModal.open) return null;
    return (
      <div className="inventory-modal-backdrop" onClick={closeDeactivateModal}>
        <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <h5>Desactivar lote</h5>
            <button className="btn-close" onClick={closeDeactivateModal}></button>
          </div>
          <div className="inventory-modal-body">
            <p>
              ¿Desea desactivar el lote <strong>{deactivateModal.lote?.numeroLote}</strong> del
              producto <strong>{deactivateModal.lote?.producto}</strong>?
            </p>
            <div className="mb-3">
              <label className="form-label">Motivo (opcional)</label>
              <textarea
                className="form-control"
                rows={3}
                value={deactivateModal.motivo}
                onChange={(e) => setDeactivateModal((prev) => ({ ...prev, motivo: e.target.value }))}
              ></textarea>
            </div>
            {deactivateModal.error && <div className="alert alert-danger">{deactivateModal.error}</div>}
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={closeDeactivateModal} disabled={deactivateModal.loading}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDeactivate} disabled={deactivateModal.loading}>
                {deactivateModal.loading ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompraModal = () => {
    if (!compraModal.open) return null;
    const { loading, data, error } = compraModal;
    return (
      <div className="inventory-modal-backdrop" onClick={closeCompraModal}>
        <div className="inventory-modal inventory-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <h5>Detalle de compra</h5>
            <button className="btn-close" onClick={closeCompraModal}></button>
          </div>
          <div className="inventory-modal-body">
            {loading && <p>Cargando...</p>}
            {error && <div className="alert alert-danger">{error}</div>}
            {data && !loading && (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-sm-6">
                    <div className="info-label">Proveedor</div>
                    <div className="info-value">{data.proveedor || '—'}</div>
                  </div>
                  <div className="col-sm-3">
                    <div className="info-label">Fecha</div>
                    <div className="info-value">{formatDate(data.fechaOrden)}</div>
                  </div>
                  <div className="col-sm-3">
                    <div className="info-label">Total</div>
                    <div className="info-value">{formatCurrency(data.total)}</div>
                  </div>
                  <div className="col-sm-6">
                    <div className="info-label">Registrado por</div>
                    <div className="info-value">{data.usuarioNombre || '—'}</div>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Lote</th>
                        <th>Vencimiento</th>
                        <th className="text-end">Empaques</th>
                        <th className="text-end">Unidades mín.</th>
                        <th className="text-end">Precio costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items?.map((item) => (
                        <tr key={item.detalleCompraId}>
                          <td>{item.producto}</td>
                          <td>{item.numeroLote || '—'}</td>
                          <td>{formatDate(item.fechaVencimiento)}</td>
                          <td className="text-end">{formatNumber(item.cantidadEmpaques)}</td>
                          <td className="text-end">{formatNumber(item.cantidadUnidadesMinimas)}</td>
                          <td className="text-end">{formatCurrency(item.precioCosto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const resumenMetrics = dashboard?.metrics;
  const filteredProducts = useMemo(() => {
    if (!dashboard?.products) return [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return dashboard.products;
    return dashboard.products.filter((prod) => {
      const haystack = [
        prod.nombre,
        prod.categoria,
        prod.estado,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return haystack.some((value) => value.includes(term));
    });
  }, [dashboard, productSearch]);

  const productColumns = useMemo(() => [
    {
      name: 'Producto',
      selector: (row) => row.nombre,
      sortable: true,
      grow: 2,
      cell: (row) => (
        <div>
          <div className="fw-semibold">{row.nombre}</div>
          <div className="text-muted small">
            Empaques: {formatNumber(row.stockEmpaques)} / Unidades mín.: {formatNumber(row.stockUnidadesMinimas)}
          </div>
        </div>
      ),
    },
    {
      name: 'Categoría',
      selector: (row) => row.categoria || '—',
      sortable: true,
      grow: 1,
    },
    {
      name: 'Stock total (unidades)',
      selector: (row) => row.stockTotalMinimo,
      sortable: true,
      right: true,
      cell: (row) => <span>{formatNumber(row.stockTotalMinimo)}</span>,
    },
    {
      name: 'Stock mínimo',
      selector: (row) => row.stockMinimo,
      sortable: true,
      right: true,
      cell: (row) => (
        <span className={row.stockTotalMinimo < row.stockMinimo ? 'text-danger fw-semibold' : ''}>
          {formatNumber(row.stockMinimo)}
        </span>
      ),
    },
    {
      name: 'Estado',
      selector: (row) => row.estado,
      sortable: true,
      cell: (row) => (
        <span className={`badge ${row.activo ? 'bg-success' : 'bg-secondary'}`}>
          {row.estado}
        </span>
      ),
    },
    {
      name: 'Acciones',
      button: true,
      cell: (row) => (
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => handleOpenProductLotsModal(row)}
        >
          <i className="bi bi-eye me-1" />
          Ver lotes
        </button>
      ),
    },
  ], [handleOpenProductLotsModal]);

  return (
    <div className="inventario-page container-fluid py-3">
      <div className="d-flex align-items-center flex-wrap gap-2 mb-4">
        <h3 className="mb-0"><i className="bi bi-box-seam me-2" />Inventario</h3>
        <div className="ms-auto btn-group">
          <button
            className={`btn btn-outline-primary ${activeTab === 'resumen' ? 'active' : ''}`}
            onClick={() => handleChangeTab('resumen')}
          >
            Resumen
          </button>
          <button
            className={`btn btn-outline-primary ${activeTab === 'compras' ? 'active' : ''}`}
            onClick={() => handleChangeTab('compras')}
          >
            Compras
          </button>
          <button
            className={`btn btn-outline-primary ${activeTab === 'lotes' ? 'active' : ''}`}
            onClick={() => handleChangeTab('lotes')}
          >
            Lotes
          </button>
        </div>
      </div>

      {activeTab === 'resumen' && (
        <div>
          {dashboardLoading && <div className="alert alert-info">Cargando resumen...</div>}
          {dashboardError && <div className="alert alert-danger">{dashboardError}</div>}
          {dashboard && (
            <>
              <div className="row g-3 mb-4">
                <div className="col-sm-6 col-xl-3">
                  <button className="inventory-card-button w-100" onClick={() => openCardModal('valor')}>
                    <StatsCard
                      title="Valor inventario"
                      value={formatCurrency(resumenMetrics?.inventoryValue?.total || 0)}
                      icon="bi-cash-stack"
                      color="primary"
                    />
                  </button>
                </div>
                <div className="col-sm-6 col-xl-3">
                  <button className="inventory-card-button w-100" onClick={() => openCardModal('vencimientos')}>
                    <StatsCard
                      title="Próximos a vencer"
                      value={formatNumber(resumenMetrics?.expiringLots?.total || 0)}
                      icon="bi-exclamation-triangle"
                      color="warning"
                      subtitle={`<30d: ${formatNumber(resumenMetrics?.expiringLots?.lessThan30 || 0)} / 31-60d: ${formatNumber(resumenMetrics?.expiringLots?.between31And60 || 0)}`}
                    />
                  </button>
                </div>
                <div className="col-sm-6 col-xl-3">
                  <button className="inventory-card-button w-100" onClick={() => openCardModal('bajoStock')}>
                    <StatsCard
                      title="Productos con stock bajo"
                      value={formatNumber(resumenMetrics?.lowStock?.total || 0)}
                      icon="bi-arrow-down-short"
                      color="danger"
                    />
                  </button>
                </div>
                <div className="col-sm-6 col-xl-3">
                  <button className="inventory-card-button w-100" onClick={() => openCardModal('activos')}>
                    <StatsCard
                      title="Productos activos"
                      value={formatNumber(resumenMetrics?.activeProducts?.total || 0)}
                      icon="bi-check-circle"
                      color="success"
                    />
                  </button>
                </div>
              </div>

              <div className="card shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <h5 className="mb-0">Productos</h5>
                    <div className="inventory-search-wrapper">
                      <input
                        type="search"
                        className="form-control"
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        style={{ maxWidth: '320px' }}
                      />
                    </div>
                  </div>
                  <DataTable
                    columns={productColumns}
                    data={filteredProducts}
                    pagination
                    paginationPerPage={20}
                    paginationRowsPerPageOptions={[10, 20, 30, 40, 50]}
                    highlightOnHover
                    striped
                    responsive
                    persistTableHead
                    noDataComponent="No se encontraron productos."
                    paginationComponentOptions={{
                      rowsPerPageText: 'Filas:',
                      rangeSeparatorText: 'de',
                    }}
                    conditionalRowStyles={[{
                      when: (row) => row.stockTotalMinimo < row.stockMinimo,
                      style: { backgroundColor: 'rgba(220,53,69,0.08)' },
                    }]}
                    customStyles={{
                      cells: {
                        style: {
                          whiteSpace: 'normal',
                        },
                      },
                      headCells: {
                        style: {
                          whiteSpace: 'normal',
                          fontWeight: '600',
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'lotes' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <div className="flex-grow-1">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Buscar por producto o lote..."
                  value={loteFilters.buscar}
                  onChange={(e) => handleChangeFilters('buscar', e.target.value)}
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                <select
                  className="form-select"
                  value={loteFilters.estado}
                  onChange={(e) => handleChangeFilters('estado', e.target.value)}
                >
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                  <option value="todos">Todos</option>
                </select>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="filterProximos"
                    checked={loteFilters.proximos}
                    onChange={(e) => handleChangeFilters('proximos', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="filterProximos">
                    Próximos a vencer (≤60 días)
                  </label>
                </div>
              </div>
            </div>
            {lotesLoading && <div className="alert alert-info">Cargando lotes...</div>}
            {lotesError && <div className="alert alert-danger">{lotesError}</div>}
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th className="text-end">Stock (unidades)</th>
                    <th className="text-end">Precio venta</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((lote) => (
                    <tr key={lote.loteId}>
                      <td>
                        <div className="fw-semibold">{lote.producto}</div>
                        <div className="text-muted small">{lote.categoria}</div>
                      </td>
                      <td>{lote.numeroLote}</td>
                      <td>
                        {formatDate(lote.fechaVencimiento)}
                        {lote.alertaVencimiento && (
                          <span className={`badge ms-2 ${lote.alertaVencimiento === 'critico' ? 'bg-danger' : lote.alertaVencimiento === 'aviso' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                            {lote.alertaVencimiento === 'vencido'
                              ? 'Vencido'
                              : lote.alertaVencimiento === 'critico'
                              ? '<= 30d'
                              : '<= 60d'}
                          </span>
                        )}
                      </td>
                      <td className="text-end">{formatNumber(lote.cantidadTotalMinima)}</td>
                      <td className="text-end">{formatCurrency(lote.precioVenta)}</td>
                      <td>
                        <span className={`badge ${lote.activo ? 'bg-success' : 'bg-secondary'}`}>
                          {lote.estado}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => openLoteModal('view', lote)}>
                            <i className="bi bi-eye" />
                          </button>
                          <button className="btn btn-outline-primary" onClick={() => openLoteModal('edit', lote)}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => openDeactivateModal(lote)}
                            disabled={!lote.activo}
                          >
                            <i className="bi bi-dash-circle" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {lotes.length === 0 && !lotesLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">
                        No hay lotes que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compras' && (
        <div className="row g-3">
          <div className="col-12 col-xxl-7">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h5 className="mb-3">Registrar compra / ingreso</h5>
                <form onSubmit={handleSubmitCompra}>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Proveedor <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={selectedProveedor}
                        onChange={(e) => setSelectedProveedor(e.target.value)}
                        required
                      >
                        <option value="">Seleccione proveedor...</option>
                        {proveedores.map((prov) => (
                          <option key={prov.ProveedorID} value={prov.ProveedorID}>
                            {prov.NombreProveedor}
                          </option>
                        ))}
                      </select>
                      {proveedoresLoading && <small className="text-muted">Cargando proveedores...</small>}
                      {proveedoresError && <FieldError error={proveedoresError} />}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Registrado por</label>
                      <div className="form-control-plaintext">
                        {user ? `${user.nombres || ''} ${user.apellidos || ''}`.trim() || user.username : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="purchase-items">
                    {purchaseItems.map((item, index) => (
                      <div className="card mb-3 border-0 shadow-sm purchase-item-card" key={item.id}>
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">Producto #{index + 1}</h6>
                            {purchaseItems.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRemoveCompraItem(item.id)}
                              >
                                <i className="bi bi-trash me-1" />
                                Quitar
                              </button>
                            )}
                          </div>

                          <div className="row g-3">
                            <div className="col-md-8">
                              <label className="form-label">
                                Buscar producto <span className="text-danger">*</span>
                              </label>
                              <ProductSelector
                                onSelect={(producto) => handleSelectProducto(item.id, producto)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Lote existente</label>
                              <select
                                className="form-select"
                                value={item.loteSeleccion === 'existente' ? item.loteId : ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (!value) {
                                    updateCompraItem(item.id, {
                                      loteSeleccion: 'nuevo',
                                      loteId: '',
                                      numeroLote: '',
                                      fechaVencimiento: '',
                                    });
                                  } else {
                                    handleSelectLoteExistente(item.id, value);
                                  }
                                }}
                                disabled={!item.productoId || item.lotesDisponibles.length === 0}
                              >
                                <option value="">Crear nuevo lote</option>
                                {item.lotesDisponibles.map((lote) => (
                                  <option key={lote.loteId} value={lote.loteId}>
                                    {lote.numeroLote} — vence {formatDate(lote.fechaVencimiento)}
                                  </option>
                                ))}
                              </select>
                              {item.lotesDisponibles.length === 0 && item.productoId && (
                                <small className="text-muted">No hay lotes activos para este producto.</small>
                              )}
                            </div>

                            {item.loteSeleccion === 'existente' && item.loteId ? (
                              <div className="col-12">
                                <div className="alert alert-light border">
                                  Utilizando lote existente <strong>{item.numeroLote}</strong>. Precios y fechas se mantienen.
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="col-md-6">
                                  <label className="form-label">Numero de lote <span className="text-danger">*</span></label>
                                  <input
                                    className="form-control"
                                    value={item.numeroLote}
                                    onChange={(e) => updateCompraItem(item.id, { numeroLote: e.target.value })}
                                    required
                                  />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Fecha de vencimiento <span className="text-danger">*</span></label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    value={item.fechaVencimiento}
                                    onChange={(e) => updateCompraItem(item.id, { fechaVencimiento: e.target.value })}
                                    required
                                  />
                                </div>
                              </>
                            )}

                            <div className="col-md-3">
                              <label className="form-label">Precio costo <span className="text-danger">*</span></label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control"
                                value={item.precioCosto}
                                onChange={(e) => updateCompraItem(item.id, { precioCosto: e.target.value })}
                                required
                                disabled={item.loteSeleccion === 'existente' && item.loteId}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Precio venta <span className="text-danger">*</span></label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control"
                                value={item.precioVenta}
                                onChange={(e) => updateCompraItem(item.id, { precioVenta: e.target.value })}
                                required
                                disabled={item.loteSeleccion === 'existente' && item.loteId}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Impuesto (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control"
                                value={item.impuesto}
                                onChange={(e) => updateCompraItem(item.id, { impuesto: e.target.value })}
                                disabled={item.loteSeleccion === 'existente' && item.loteId}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Descuento (%)</label>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control"
                                value={item.descuento}
                                onChange={(e) => updateCompraItem(item.id, { descuento: e.target.value })}
                                disabled={item.loteSeleccion === 'existente' && item.loteId}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Empaques</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="form-control"
                                value={item.cantidadEmpaques}
                                onChange={(e) => updateCompraItem(item.id, { cantidadEmpaques: e.target.value })}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Unidades mínimas</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="form-control"
                                value={item.cantidadUnidadesMinimas}
                                onChange={(e) => updateCompraItem(item.id, { cantidadUnidadesMinimas: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {purchaseErrors && <div className="alert alert-danger">{purchaseErrors}</div>}
                  {createCompraOk && <div className="alert alert-success">{createCompraOk}</div>}

                  <div className="d-flex justify-content-between align-items-center">
                    <button type="button" className="btn btn-outline-secondary" onClick={handleAddCompraItem}>
                      <i className="bi bi-plus-lg me-1" />
                      Agregar producto
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={creatingCompra}>
                      {creatingCompra ? 'Guardando...' : 'Registrar compra'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-12 col-xxl-5">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <h5 className="mb-0">Historial de compras</h5>
                  <ExportMenuButton
                    onExport={handleExportCompras}
                    options={comprasExportOptions}
                    disabled={comprasLoading || comprasExportButtonDisabled}
                    loading={Boolean(comprasExporting)}
                    className="ms-auto"
                  />
                </div>
                {comprasError && <div className="alert alert-danger">{comprasError}</div>}
                <DataTable
                  columns={comprasColumns}
                  data={compras}
                  pagination
                  paginationServer
                  paginationTotalRows={comprasTotal}
                  paginationPerPage={comprasPageSize}
                  paginationDefaultPage={comprasPage}
                  paginationResetDefaultPage={comprasPaginationReset}
                  onChangePage={handleComprasPageChange}
                  onChangeRowsPerPage={(newPerPage) => handleComprasPageSizeChange(newPerPage)}
                  paginationRowsPerPageOptions={[5, 10, 20, 50]}
                  paginationComponentOptions={{ rowsPerPageText: 'Filas:', rangeSeparatorText: 'de' }}
                  highlightOnHover
                  striped
                  responsive
                  persistTableHead
                  progressPending={comprasLoading}
                  progressComponent={<div className="py-3 text-center mb-0">Cargando compras...</div>}
                  noDataComponent="Aun no hay compras registradas."
                />
            </div>
          </div>
        </div>
      </div>
    )}

      {renderCardModal()}
      {renderProductLotsModal()}
      {renderLoteModal()}
      {renderDeactivateModal()}
      {renderCompraModal()}
    </div>
  );
}
