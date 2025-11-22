import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './InventarioPage.css';
import StatsCard from '../components/StatsCard';
import ProductSelector from '../components/ProductSelector';
import DataTable from 'react-data-table-component';
import ActionButton from '../components/ActionButton';
import TabBar from '../components/TabBar';
import Toast from '../components/recursos/Toast';
import {
  getInventarioResumen,
  getLotes,
  getLoteDetalle,
  updateLote,
  deactivateLote,
  getCompras,
  getCompra,
  createCompra,
  getMarcas,
} from '../services/inventoryService';
import { getProveedores } from '../services/proveedoresService';
import { getUser } from '../services/authService';
import { formatCurrency } from '../utils/formatters';

const numberFormatter = new Intl.NumberFormat('es-DO');

const tabOptions = [
  { value: 'resumen', label: 'Resumen', icon: 'bi bi-speedometer2' },
  { value: 'compras', label: 'Compras', icon: 'bi bi-bag-check' },
  { value: 'lotes', label: 'Lotes', icon: 'bi bi-clipboard-data' },
];



const formatNumber = (value) => numberFormatter.format(Number(value || 0));
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const lotesTableStyles = {
  cells: {
    style: {
      paddingTop: '10px',
      paddingBottom: '10px',
      paddingLeft: '5px',
      paddingRight: '5px',
    },
  },
};

const defaultLoteFilters = {
  buscar: '',
  estado: 'todos',
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
  marcaId: '',
  marcaNombre: '',
  precioCosto: '',
  precioVenta: '',
  descuento: 0,
  cantidadEmpaques: '',
  cantidadUnidadesMinimas: '',
});

function FieldError({ error }) {
  if (!error) return null;
  return <div className="field-error text-danger mt-1">{error}</div>;
}

export default function InventarioPage({ initialTab = 'resumen' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const [cardModal, setCardModal] = useState({ type: null });
  const [productLotsModal, setProductLotsModal] = useState({ open: false, product: null, loading: false, error: '', lots: [] });

  const [loteFilters, setLoteFilters] = useState(defaultLoteFilters);
  const [lotes, setLotes] = useState([]);
  const [lotesLoading, setLotesLoading] = useState(false);
  const [lotesError, setLotesError] = useState('');
  const [lotesPage, setLotesPage] = useState(1);
  const [lotesPageSize, setLotesPageSize] = useState(10);
  const [lotesPaginationReset, setLotesPaginationReset] = useState(false);

  const [loteModal, setLoteModal] = useState({ open: false, mode: 'view', loteId: null, loading: false, data: null, initialData: null, error: '' });
  const [deactivateModal, setDeactivateModal] = useState({ open: false, lote: null, loading: false, error: '', motivo: '' });

  const [compras, setCompras] = useState([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [comprasError, setComprasError] = useState('');
  const [comprasPage, setComprasPage] = useState(1);
  const [comprasPageSize, setComprasPageSize] = useState(5);
  const [comprasTotal, setComprasTotal] = useState(0);
  const [comprasPaginationReset, setComprasPaginationReset] = useState(false);
  const [compraModal, setCompraModal] = useState({ open: false, compraId: null, loading: false, data: null, error: '' });
  const [comprasSearch, setComprasSearch] = useState('');

  const [proveedores, setProveedores] = useState([]);
  const [proveedoresLoading, setProveedoresLoading] = useState(false);
  const [proveedoresError, setProveedoresError] = useState('');
  const [marcas, setMarcas] = useState([]);
  const [marcasLoading, setMarcasLoading] = useState(false);
  const [marcasError, setMarcasError] = useState('');

  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([createEmptyCompraItem(0)]);
  const [purchaseErrors, setPurchaseErrors] = useState('');
  const [purchaseItemErrors, setPurchaseItemErrors] = useState({});
  const [purchaseFormErrors, setPurchaseFormErrors] = useState({ proveedor: '' });
  const [creatingCompra, setCreatingCompra] = useState(false);
  const [createCompraOk, setCreateCompraOk] = useState('');
  // Modal de confirmacin de compra
  const [confirmCompra, setConfirmCompra] = useState({ open: false, payload: null, proveedor: null, items: [] });
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [toastKey, setToastKey] = useState(Date.now());

  const triggerToast = useCallback((type, message) => {
    if (!message) return;
    setToastType(type);
    setToastMsg(message);
    setToastKey(Date.now());
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [productSearch, setProductSearch] = useState('');
  const [cardModalSearch, setCardModalSearch] = useState('');
  const [productLotsSearch, setProductLotsSearch] = useState('');

  const user = useMemo(() => getUser(), []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const data = await getInventarioResumen();
      setDashboard(data);
    } catch (err) {
      const message = err.message || 'No se pudo obtener el resumen.';
      setDashboardError(message);
      triggerToast('error', message);
    } finally {
      setDashboardLoading(false);
    }
  }, [selectedProveedor, triggerToast]);

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
      // Reset paginacin al cargar un nuevo set de lotes
      setLotesPage(1);
      setLotesPaginationReset((prev) => !prev);
    } catch (err) {
      const message = err.message || 'No se pudo obtener la lista de lotes.';
      setLotesError(message);
      triggerToast('error', message);
    } finally {
      setLotesLoading(false);
    }
  }, [loteFilters, triggerToast]);

  const handleLotesPageChange = (newPage) => {
    const parsed = Number(newPage);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const normalized = Math.floor(parsed);
    if (normalized === lotesPage) return;
    setLotesPage(normalized);
  };

  const handleLotesPageSizeChange = (newSize) => {
    const parsed = Number(newSize);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const normalized = Math.floor(parsed);
    if (normalized === lotesPageSize) return;
    setLotesPageSize(normalized);
    setLotesPage(1);
    setLotesPaginationReset((prev) => !prev);
  };

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
        const message = err.message || 'No se pudo obtener la lista de compras.';
        setCompras([]);
        setComprasError(message);
        triggerToast('error', message);
        if (comprasTotal !== 0) setComprasTotal(0);
      } finally {
        setComprasLoading(false);
      }
    },
    [comprasPage, comprasPageSize, comprasTotal, triggerToast]
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

  const loadProveedores = useCallback(async () => {
    setProveedoresLoading(true);
    setProveedoresError('');
    try {
      const data = await getProveedores();
      const activos = Array.isArray(data) ? data.filter((prov) => prov.Activo !== false && prov.Activo !== 0) : [];
      setProveedores(activos);
      if (selectedProveedor && !activos.some((prov) => String(prov.ProveedorID) === String(selectedProveedor))) {
        setSelectedProveedor('');
      }
    } catch (err) {
      const message = err.message || 'No se pudo obtener proveedores.';
      setProveedoresError(message);
      triggerToast('error', message);
    } finally {
      setProveedoresLoading(false);
    }
  }, [triggerToast]);

  const loadMarcas = useCallback(async () => {
    setMarcasLoading(true);
    setMarcasError('');
    try {
      const data = await getMarcas();
      const activosOrdenados = Array.isArray(data)
        ? data
          .filter((marca) => marca.activo !== false && marca.activo !== 0)
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }))
        : [];
      setMarcas(activosOrdenados);
    } catch (err) {
      const message = err.message || 'No se pudieron obtener las marcas.';
      setMarcasError(message);
      triggerToast('error', message);
    } finally {
      setMarcasLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    if (!marcas.length) loadMarcas();
  }, [loadMarcas, marcas.length]);

  useEffect(() => {
    if (activeTab === 'resumen') loadDashboard();
    if (activeTab === 'lotes') loadLotes();
    if (activeTab === 'compras') {
      loadCompras(comprasPage, comprasPageSize);
      if (!proveedores.length) loadProveedores();
      if (!marcas.length) loadMarcas();
    }
  }, [
    activeTab,
    comprasPage,
    comprasPageSize,
    proveedores.length,
    marcas.length,
    loadDashboard,
    loadLotes,
    loadCompras,
    loadProveedores,
    loadMarcas,
  ]);

  const handleChangeTab = (tab) => setActiveTab(tab);

  const openCardModal = (type) => { setCardModalSearch(''); setCardModal({ type }); };
  const closeCardModal = () => setCardModal({ type: null });

  const handleOpenProductLotsModal = useCallback(async (product) => {
    setProductLotsSearch('');
    setProductLotsModal({ open: true, product, loading: true, error: '', lots: [] });
    try {
      const data = await getLotes({ productoId: product.productoId, estado: 'activos' });
      setProductLotsModal((prev) => ({ ...prev, loading: false, lots: data }));
    } catch (err) {
      const message = err.message || 'No se pudieron obtener los lotes.';
      setProductLotsModal((prev) => ({ ...prev, loading: false, error: message }));
      triggerToast('error', message);
    }
  }, [triggerToast]);

  const closeProductLotsModal = () => setProductLotsModal({ open: false, product: null, loading: false, error: '', lots: [] });

  const openLoteModal = async (mode, lote) => {
    setLoteModal({ open: true, mode, loteId: lote.loteId, loading: true, data: null, initialData: null, error: '' });
    try {
      const detail = await getLoteDetalle(lote.loteId);
      setLoteModal((prev) => ({ ...prev, loading: false, data: detail, initialData: { ...detail } }));
    } catch (err) {
      const message = err.message || 'No se pudo obtener el detalle.';
      setLoteModal((prev) => ({ ...prev, loading: false, error: message }));
      triggerToast('error', message);
    }
  };

  const closeLoteModal = () => setLoteModal({ open: false, mode: 'view', loteId: null, loading: false, data: null, initialData: null, error: '' });

  const saveLoteChanges = async () => {
    if (!loteModal?.data?.loteId) return;
    setLoteModal((prev) => ({ ...prev, loading: true, error: '' }));
    if (!loteModal?.data?.marcaId) {
      const message = 'Seleccione la marca del lote.';
      setLoteModal((prev) => ({ ...prev, error: message }));
      triggerToast('error', message);
      return;
    }
    const payload = {
      numeroLote: loteModal.data.numeroLote,
      FechaVencimiento: loteModal.data.fechaVencimiento,
      PrecioCosto: Number(loteModal.data.precioCosto),
      PrecioVenta: Number(loteModal.data.precioVenta),
      Descuento: Number(loteModal.data.descuento),
    };
    payload.MarcaID = Number(loteModal.data.marcaId);
    try {
      await updateLote(loteModal.data.loteId, payload);
      closeLoteModal();
      loadLotes();
      if (activeTab === 'resumen') loadDashboard();
      triggerToast('success', 'Lote actualizado correctamente.');
    } catch (err) {
      const message = err.message || 'Error al actualizar lote.';
      setLoteModal((prev) => ({ ...prev, loading: false, error: message }));
      triggerToast('error', message);
    }
  };

  const openDeactivateModal = (lote) => {
    setDeactivateModal({ open: true, lote, loading: false, error: '', motivo: '' });
  };

  const closeDeactivateModal = () =>
    setDeactivateModal({ open: false, lote: null, loading: false, error: '', motivo: '' });

  const confirmDeactivate = async () => {
    if (!deactivateModal.lote) return;
    const motivo = (deactivateModal.motivo || '').trim();
    if (!motivo) {
      setDeactivateModal((prev) => ({ ...prev, error: 'Ingrese el motivo de la desactivación.' }));
      return;
    }
    setDeactivateModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await deactivateLote(deactivateModal.lote.loteId, { motivo });
      closeDeactivateModal();
      loadLotes();
      if (activeTab === 'resumen') loadDashboard();
      triggerToast('success', 'Lote desactivado correctamente.');
    } catch (err) {
      const message = err.message || 'No se pudo desactivar el lote.';
      setDeactivateModal((prev) => ({ ...prev, loading: false, error: message }));
      triggerToast('error', message);
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
      const message = err.message || 'No se pudo obtener la compra.';
      setCompraModal((prev) => ({ ...prev, loading: false, error: message }));
      triggerToast('error', message);
    }
  }, [triggerToast]);

  const comprasColumns = useMemo(
    () => [
      {
        name: 'Fecha',
        selector: (row) => row.fechaOrden,
        sortable: true,
        cell: (row) => formatDate(row.fechaOrden),
        minWidth: '110px',
      },
      {
        name: 'Proveedor',
        selector: (row) => row.proveedor,
        sortable: true,
        cell: (row) => row.proveedor || 'Sin proveedor',
        wrap: true,
        minWidth: '200px',
      },
      {
        name: 'Total',
        selector: (row) => row.total,
        sortable: true,
        cell: (row) => formatCurrency(row.total),
        right: true,
        minWidth: '110px',
      },
      {
        name: 'Items',
        selector: (row) => row.items,
        sortable: true,
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
          <ActionButton
            variant="outline-primary-compact"
            icon="bi bi-eye"
            text="Detalle"
            type="button"
            onClick={() => handleSelectCompra(row.ordenCompraId)}
          />
        ),
      },
    ],
    [handleSelectCompra]
  );

  const filteredCompras = useMemo(() => {
    const term = (comprasSearch || '').toString().trim().toLowerCase();
    if (!term) return compras;
    return compras.filter((c) => {
      const bag = [c.proveedor, c.usuarioNombre, c.total, c.items]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).toLowerCase())
        .join(' ');
      return bag.includes(term);
    });
  }, [compras, comprasSearch]);

  const closeCompraModal = () => setCompraModal({ open: false, compraId: null, loading: false, data: null, error: '' });

  const handleAddCompraItem = () => {
    setPurchaseItems((prev) => [...prev, createEmptyCompraItem(prev.length)]);
  };

  const handleRemoveCompraItem = (id) => {
    setPurchaseItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const updateCompraItem = (id, updater) => {
    const patch = typeof updater === 'function' ? updater((purchaseItems.find((i) => i.id === id)) || {}) : updater;
    setPurchaseItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    // Limpia errores del/los campos actualizados
    if (patch && typeof patch === 'object') {
      setPurchaseItemErrors((prev) => {
        const current = { ...(prev[id] || {}) };
        Object.keys(patch).forEach((k) => { if (current[k]) delete current[k]; });
        return { ...prev, [id]: current };
      });
    }
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
      marcaId: '',
      marcaNombre: '',
      precioCosto: producto.PrecioCosto ?? '',
      precioVenta: producto.PrecioVenta ?? '',
      descuento: 0,
      cantidadEmpaques: '',
      cantidadUnidadesMinimas: '',
    });
    try {
      const lotesProducto = await getLotes({ productoId: producto.ProductoID, estado: 'activos' });
      updateCompraItem(id, { lotesDisponibles: lotesProducto });
    } catch (err) {
      triggerToast('error', err.message || 'No se pudieron cargar los lotes del producto.');
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
          marcaId: '',
          marcaNombre: '',
        };
      }
      return {
        loteSeleccion: 'existente',
        loteId: lote.loteId,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento || '',
        precioCosto: lote.precioCosto,
        precioVenta: lote.precioVenta,
        descuento: lote.descuento,
        cantidadUnidadesMinimas: lote.cantidadUnidadesMinimas || '',
        marcaId: lote.marcaId ? String(lote.marcaId) : '',
        marcaNombre: lote.marcaNombre || '',
      };
    });
  };

  const handleSubmitCompra = async (event) => {
    event.preventDefault();
    setPurchaseErrors('');
    setCreateCompraOk('');
    setPurchaseFormErrors({ proveedor: '' });

    let hasErrors = false;
    if (!selectedProveedor) {
      setPurchaseFormErrors({ proveedor: 'Seleccione un proveedor.' });
      hasErrors = true;
    }

    const itemsPayload = [];
    const nextItemErrors = {};
    for (const item of purchaseItems) {
      const errs = {};
      if (!item.productoId) {
        errs.producto = 'Seleccione un producto.'; hasErrors = true;
      }
      const isNuevo = item.loteSeleccion !== 'existente' || !item.loteId;
      if (isNuevo) {
        if (!item.numeroLote || !String(item.numeroLote).trim()) { errs.numeroLote = 'Ingrese el número de lote.'; hasErrors = true; }
        if (!item.fechaVencimiento) { errs.fechaVencimiento = 'Seleccione la fecha de vencimiento.'; hasErrors = true; }
        if (!item.marcaId) { errs.marcaId = 'Seleccione la marca.'; hasErrors = true; }
        // Precio costo y precio venta: requeridos, no negativos, y venta > costo
        const hasPc = item.precioCosto !== '' && item.precioCosto !== null && item.precioCosto !== undefined;
        const hasPv = item.precioVenta !== '' && item.precioVenta !== null && item.precioVenta !== undefined;
        const pc = Number(item.precioCosto);
        const pv = Number(item.precioVenta);
        if (!hasPc || !Number.isFinite(pc) || pc < 0) { errs.precioCosto = !hasPc ? 'Ingrese el precio costo.' : 'Precio costo invlido.'; hasErrors = true; }
        if (!hasPv || !Number.isFinite(pv) || pv < 0) { errs.precioVenta = !hasPv ? 'Ingrese el precio venta.' : 'Precio venta invlido.'; hasErrors = true; }
        if (Number.isFinite(pc) && Number.isFinite(pv) && !(pv > pc)) { errs.precioVenta = 'Precio venta debe ser mayor que precio costo.'; hasErrors = true; }
        const desc = Number(item.descuento);
        if (item.descuento !== '' && (!Number.isFinite(desc) || desc < 0 || desc > 100)) { errs.descuento = 'Descuento 0 a 100.'; hasErrors = true; }
      }
      const empProvided = item.cantidadEmpaques !== '' && item.cantidadEmpaques !== null && item.cantidadEmpaques !== undefined;
      const uniProvided = item.cantidadUnidadesMinimas !== '' && item.cantidadUnidadesMinimas !== null && item.cantidadUnidadesMinimas !== undefined;
      const emp = Number(item.cantidadEmpaques);
      const uni = Number(item.cantidadUnidadesMinimas);
      if (!empProvided || !Number.isFinite(emp) || emp <= 0) { errs.cantidadEmpaques = 'Ingrese empaques (> 0).'; hasErrors = true; }
      if (!uniProvided || !Number.isFinite(uni) || uni <= 0) { errs.cantidadUnidadesMinimas = 'Ingrese unidades mnimas (> 0).'; hasErrors = true; }

      if (Object.keys(errs).length) nextItemErrors[item.id] = errs;
      itemsPayload.push({
        productoId: item.productoId,
        loteId: isNuevo ? null : Number(item.loteId),
        crearNuevoLote: isNuevo,
        numeroLote: item.numeroLote,
        fechaVencimiento: item.fechaVencimiento,
        marcaId: isNuevo ? Number(item.marcaId) : null,
        precioCosto: Number(item.precioCosto),
        precioVenta: Number(item.precioVenta),
        descuento: Number(item.descuento),
        cantidadEmpaques: Number(item.cantidadEmpaques || 0),
        cantidadUnidadesMinimas: Number(item.cantidadUnidadesMinimas || 0),
      });
    }

    if (hasErrors) {
      setPurchaseItemErrors(nextItemErrors);
      return;
    }

    // Preparar payload y vista previa para el modal de confirmacin
    const payload = {
      proveedorId: Number(selectedProveedor),
      items: itemsPayload,
    };

    const proveedorObj = proveedores.find((p) => Number(p.ProveedorID) === Number(selectedProveedor));
    const proveedorLabel = proveedorObj ? `${proveedorObj.NombreProveedor} (ID: ${proveedorObj.ProveedorID})` : String(selectedProveedor);

    const previewItems = purchaseItems.map((it) => {
      const isNuevo = it.loteSeleccion !== 'existente' || !it.loteId;
      const factor = Number(it.cantidadUnidadesMinimas || 0);
      const empaques = Number(it.cantidadEmpaques || 0);
      const totalUnidades =
        Number.isFinite(factor) && factor > 0 ? empaques * factor : empaques;
      const subtotal = Number(empaques * Number(it.precioCosto || 0));
      const marcaNombre =
        it.marcaNombre ||
        (it.marcaId
          ? (marcas.find((m) => String(m.marcaId) === String(it.marcaId))?.nombre || '')
          : '');
      return {
        productoNombre: it.producto ? `${it.producto.Nombre}${it.producto.Presentacion ? ` - ${it.producto.Presentacion}` : ''}` : `ID ${it.productoId}`,
        productoId: it.productoId,
        loteTipo: isNuevo ? 'Nuevo' : 'Existente',
        loteNumero: it.numeroLote || (isNuevo ? '' : String(it.loteId || '')),
        fechaVencimiento: it.fechaVencimiento || '',
        marcaNombre,
        precioCosto: it.precioCosto,
        precioVenta: it.precioVenta,
        descuento: it.descuento,
        empaques,
        unidades: factor,
        factor,
        totalUnidades,
        subtotal,
      };
    });

    setConfirmCompra({ open: true, payload, proveedor: proveedorLabel, items: previewItems });
  };

  const doCreateCompra = async (payload) => {
    setCreatingCompra(true);
    try {
      await createCompra(payload);
      triggerToast('success', 'Compra registrada correctamente.');
      setPurchaseItems([createEmptyCompraItem(0)]);
      setSelectedProveedor('');
      if (comprasPage !== 1) setComprasPage(1);
      setComprasPaginationReset((prev) => !prev);
      await loadCompras(1, comprasPageSize);
      loadDashboard();
      loadLotes();
    } catch (err) {
      triggerToast('error', err.message || 'No se pudo registrar la compra.');
    } finally {
      setCreatingCompra(false);
    }
  };

  const renderCardModal = () => {
    if (!cardModal.type || !dashboard) return null;
    let title = '';
    let rows = [];
    // Variantes de chip por tipo de modal (color e icono)
    const chipMap = {
      valor: { variant: 'primary', icon: 'bi-cash-stack' },
      vencimientos: { variant: 'warning', icon: 'bi-exclamation-triangle' },
      bajoStock: { variant: 'danger', icon: 'bi-arrow-down-short' },
      activos: { variant: 'success', icon: 'bi-check-circle' },
    };
    const { variant: chipVariant = 'primary', icon: chipIcon = 'bi-info-circle' } = chipMap[cardModal.type] || {};
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
        <div className="inventory-modal resumen-modal" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <div className="d-flex align-items-center gap-2">
              <div className={`resumen-chip resumen-chip-${chipVariant}`}>
                <i className={`bi ${chipIcon}`} />
                <span>{title}</span>
              </div>
            </div>
            <button className="btn-close" onClick={closeCardModal}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="inventory-modal-body">
            {rows.length === 0 ? (
              <p className="text-muted mb-0">Sin datos disponibles.</p>
            ) : (
              (() => {
                const columns = [];
                columns.push({
                  name: 'Producto',
                  selector: (r) => r.producto || r.nombre || '—',
                  sortable: true,
                  wrap: true,
                  grow: 2,
                  cell: (r) => (
                    <div>
                      <div className="fw-semibold">{r.producto || r.nombre || '—'}</div>
                      {r.categoria && <div className="text-muted small">{r.categoria}</div>}
                    </div>
                  ),
                });
                columns.push({
                  name: 'Detalle',
                  grow: 2,
                  cell: (r) => (
                    <div>
                      {cardModal.type === 'valor' && (
                        <>
                          <div>Lote: {r.numeroLote || '—'}</div>
                          <div>{formatNumber(r.cantidadTotalMinima)} unidades totales</div>
                          {r.fechaVencimiento && <div>Vence: {formatDate(r.fechaVencimiento)}</div>}
                        </>
                      )}
                      {cardModal.type === 'vencimientos' && (
                        <>
                          <div>Lote: {r.numeroLote || '—'}</div>
                          <div>Vence en {formatNumber(r.diasRestantes)} días</div>
                        </>
                      )}
                      {cardModal.type === 'bajoStock' && (
                        <>
                          <div>Stock actual: {formatNumber(r.stockActual)}</div>
                          <div>mínimo: {formatNumber(r.stockMinimo)}</div>
                          <div>Faltante: {formatNumber(r.deficit)}</div>
                        </>
                      )}
                      {cardModal.type === 'activos' && (
                        <>
                          <div>Stock total: {formatNumber(r.stockTotalMinimo)}</div>
                          <div>mínimo: {formatNumber(r.stockMinimo)}</div>
                        </>
                      )}
                    </div>
                  ),
                });
                if (cardModal.type === 'valor') {
                  columns.push({
                    name: 'Valor',
                    right: true,
                    width: '140px',
                    selector: (r) => r.valorTotal,
                    sortable: true, cell: (r) => formatCurrency(r.valorTotal),
                  });
                }
                const term = (cardModalSearch || '').toString().trim().toLowerCase();
                const filteredRows = term
                  ? rows.filter((r) => {
                    const haystack = [
                      r.producto, r.nombre, r.categoria, r.numeroLote,
                      r.fechaVencimiento, r.diasRestantes,
                    ]
                      .filter(Boolean)
                      .map((v) => String(v).toLowerCase())
                      .join(' ');
                    return haystack.includes(term);
                  })
                  : rows;

                return (
                  <>
                    <div className="d-flex align-items-center justify-content-end flex-wrap gap-2 mb-2">
                      <div className="inventory-search-wrapper">
                        <input
                          type="search"
                          className="form-control"
                          placeholder="Buscar..."
                          value={cardModalSearch}
                          onChange={(e) => setCardModalSearch(e.target.value)}
                          style={{ maxWidth: '320px' }}
                        />
                      </div>
                    </div>
                    <DataTable
                      columns={columns}
                      data={filteredRows}
                      pagination
                      paginationPerPage={5}
                      paginationRowsPerPageOptions={[5, 10, 30, 50]}
                      highlightOnHover
                      striped
                      responsive
                      fixedHeader
                      fixedHeaderScrollHeight="40vh"
                      persistTableHead
                      noDataComponent="Sin datos disponibles."
                      paginationComponentOptions={{
                        rowsPerPageText: 'Filas:',
                        rangeSeparatorText: 'de',
                      }}
                      customStyles={{
                        cells: { style: { whiteSpace: 'normal' } },
                        headCells: { style: { whiteSpace: 'normal', fontWeight: 600 } },
                      }}
                    />
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmCompraModal = () => {
    if (!confirmCompra.open) return null;
    const columns = [
      { name: 'Producto', selector: (r) => r.productoNombre, sortable: true, wrap: true },
      { name: 'ID', selector: (r) => r.productoId, sortable: true, width: '90px' },
      { name: 'Marca', selector: (r) => r.marcaNombre || 'Sin marca', sortable: true, wrap: true },
      { name: 'Lote', selector: (r) => `${r.loteTipo}${r.loteNumero ? ` (${r.loteNumero})` : ''}`, sortable: true, wrap: true },
      { name: 'Vence', selector: (r) => r.fechaVencimiento || '—', sortable: true, width: '120px' },
      { name: 'Empaques', selector: (r) => formatNumber(r.empaques), sortable: true, right: true, width: '110px' },
      { name: 'Unid. por emp.', selector: (r) => formatNumber(r.factor || r.unidades), sortable: true, right: true, width: '110px' },
      { name: 'Factor', selector: (r) => formatNumber(r.factor || 0), sortable: true, right: true, width: '100px' },
      { name: 'Costo', selector: (r) => formatCurrency(r.precioCosto || 0), sortable: true, right: true },
      { name: 'Subtotal', selector: (r) => r.subtotal, sortable: true, cell: (r) => formatCurrency(r.subtotal || 0), right: true, width: '140px' },
      { name: 'Venta', selector: (r) => formatCurrency(r.precioVenta || 0), sortable: true, right: true },
      { name: 'Desc.%', selector: (r) => `${Number(r.descuento || 0)}%`, right: true, width: '90px' },
    ];

    const totalItems = confirmCompra.items.length;
    const totalCosto = confirmCompra.items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);

    const close = () => setConfirmCompra({ open: false, payload: null, proveedor: null, items: [] });
    const confirm = async () => {
      const payload = confirmCompra.payload;
      close();
      await doCreateCompra(payload);
    };

    return (
      <div className="confirm-compra-backdrop" onClick={close}>
        <div className="confirm-compra-modal" onClick={(e) => e.stopPropagation()}>
          <div className="confirm-compra-header">
            <h5>Confirmar registro de compra</h5>
            <button className="btn-close" onClick={close}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="confirm-compra-body">
            <div className="mb-3">
              <div className="confirm-compra-proveedor-chip" title="Proveedor seleccionado">
                <i className="bi bi-truck" />
                <span>Proveedor: {confirmCompra.proveedor || '—'}</span>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={confirmCompra.items}
              dense
              highlightOnHover
              striped
              responsive
              persistTableHead
              noDataComponent="Sin items para registrar."
            />

          </div>
          <div className="confirm-compra-footer">
            <div className="confirm-compra-summary-chip">
              <i className="bi bi-list-check me-2" />
              <span>
                {`Items: ${formatNumber(totalItems)} | Total: ${formatCurrency(totalCosto || 0)}`}
              </span>
            </div>
            <div className="d-flex gap-2">
              <ActionButton
                variant="outline-danger"
                text="Cancelar"
                type="button"
                onClick={close}
              />
              <ActionButton
                variant="primary"
                icon="bi bi-check2-circle"
                text={creatingCompra ? "Registrando..." : "Confirmar y registrar"}
                type="button"
                onClick={confirm}
                loading={creatingCompra}
                disabled={creatingCompra}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProductLotsModal = () => {
    if (!productLotsModal.open) return null;
    const { product, lots, loading, error } = productLotsModal;
    const lotsColumns = [
      { name: 'Lote', selector: (r) => r.numeroLote, sortable: true, sortable: true, wrap: true },
      { name: 'Vencimiento', selector: (r) => r.fechaVencimiento, sortable: true, width: '140px', cell: (r) => formatDate(r.fechaVencimiento) },
      { name: 'Stock (unidades)', selector: (r) => r.cantidadTotalMinima, sortable: true, right: true, width: '160px', cell: (r) => formatNumber(r.cantidadTotalMinima) },
      { name: 'Precio costo', selector: (r) => r.precioCosto, sortable: true, right: true, width: '140px', cell: (r) => formatCurrency(r.precioCosto) },
      { name: 'Precio venta', selector: (r) => r.precioVenta, sortable: true, right: true, width: '140px', cell: (r) => formatCurrency(r.precioVenta) },
    ];
    const lotsFiltered = (() => {
      const term = (productLotsSearch || '').toString().trim().toLowerCase();
      if (!term) return lots;
      return lots.filter((l) => {
        const haystack = [
          l.numeroLote,
          l.fechaVencimiento,
          l.cantidadTotalMinima,
          l.precioCosto,
          l.precioVenta,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .join(' ');
        return haystack.includes(term);
      });
    })();
    return (
      <div className="inventory-modal-backdrop" onClick={closeProductLotsModal}>
        <div className="inventory-modal inventory-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="inventory-modal-header">
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0">Lotes del producto</h5>
              <div className="producto-chip">
                <i className="bi bi-box-seam" />
                <span>{product?.nombre || '—'}</span>
              </div>
            </div>
            <button className="btn-close" onClick={closeProductLotsModal}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="inventory-modal-body">
            {loading && <p>Cargando lotes...</p>}
            {error && <div className="alert alert-warning">{error}</div>}
            {!loading && !error && lots.length === 0 && (
              <p className="text-muted mb-0">Sin lotes activos para este producto.</p>
            )}
            {!loading && !error && lots.length > 0 && (
              <>
                <div className="d-flex align-items-center justify-content-end flex-wrap gap-2 mb-2">
                  <div className="inventory-search-wrapper">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Buscar..."
                      value={productLotsSearch}
                      onChange={(e) => setProductLotsSearch(e.target.value)}
                      style={{ maxWidth: '320px' }}
                    />
                  </div>
                </div>
                <DataTable
                  columns={lotsColumns}
                  data={lotsFiltered}
                  pagination
                  paginationPerPage={5}
                  paginationRowsPerPageOptions={[5, 10, 30, 50]}
                  highlightOnHover
                  striped
                  responsive
                  fixedHeader
                  fixedHeaderScrollHeight="50vh"
                  persistTableHead
                  noDataComponent="Sin lotes para mostrar."
                  paginationComponentOptions={{ rowsPerPageText: 'Filas:', rangeSeparatorText: 'de' }}
                />
              </>
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

    const editableFields = ['numeroLote', 'fechaVencimiento', 'precioCosto', 'precioVenta', 'descuento', 'marcaId'];
    const normalizeFieldValue = (field, value) => {
      if (value === null || value === undefined) return '';
      if (field === 'fechaVencimiento') {
        return String(value).slice(0, 10);
      }
      if (field === 'marcaId') {
        return String(value);
      }
      return String(value);
    };
    const hasChanges =
      editable &&
      data &&
      loteModal.initialData &&
      editableFields.some((field) => normalizeFieldValue(field, data[field]) !== normalizeFieldValue(field, loteModal.initialData[field]));

    return (
      <div className="inventory-modal-backdrop" onClick={closeLoteModal}>
        <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
          <form
            className="inventory-lote-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (editable) saveLoteChanges();
            }}
          >
            <div className="inventory-modal-header">
              <div className="inventory-modal-title-badge">
                <i className="bi bi-box-seam"></i>
                <span>{editable ? 'Editar lote' : 'Detalle del lote'}</span>
              </div>
              <button type="button" className="btn-close" onClick={closeLoteModal}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="inventory-modal-body">
              {loading && <p>Cargando...</p>}
              {error && <div className="alert alert-danger">{error}</div>}
              {data && !loading && (
                <div className="row g-3">
                  <div className="col-5 lote-inline-field">
                    <label className="form-label lote-detail-label mb-0">Producto</label>
                    <span className="estado-chip chip-strong ms-2 lote-product-chip">
                      <i className="bi bi-box-seam me-2" />
                      {data.producto}
                    </span>
                  </div>
                  <div className="col-md-7">
                    <label className="form-label lote-detail-label">número de lote</label>
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
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Marca</label>
                    {editable ? (
                      <select
                        className="form-select"
                        value={data.marcaId ? String(data.marcaId) : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const selected = marcas.find((marca) => String(marca.marcaId) === value);
                          setLoteModal((prev) => ({
                            ...prev,
                            error: '',
                            data: {
                              ...prev.data,
                              marcaId: value ? Number(value) : null,
                              marcaNombre: selected?.nombre || '',
                            },
                          }));
                        }}
                        disabled={marcasLoading || marcas.length === 0}
                      >
                        <option value="">Seleccione marca...</option>
                        {marcas.map((marca) => (
                          <option key={marca.marcaId} value={marca.marcaId}>
                            {marca.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="estado-chip chip-soft ms-2">{data.marcaNombre || 'Sin marca'}</span>
                    )}
                    {editable && marcasLoading && <small className="text-muted">Cargando marcas...</small>}
                    {editable && marcasError && <small className="text-danger">{marcasError}</small>}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Fecha de vencimiento</label>
                    {editable ? (
                      <input
                        type="date"
                        className="form-control"
                        value={data.fechaVencimiento ? data.fechaVencimiento.slice(0, 10) : ''}
                        onChange={(e) => updateLocalField('fechaVencimiento', e.target.value)}
                      />
                    ) : (
                      <div className="estado-chip chip-soft ms-2">{formatDate(data.fechaVencimiento)}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Precio costo</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.precioCosto ?? ''}
                        onChange={(e) => updateLocalField('precioCosto', e.target.value)}
                      />
                    ) : (
                      <div className="estado-chip chip-soft ms-2">{formatCurrency(data.precioCosto)}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Precio venta</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.precioVenta ?? ''}
                        onChange={(e) => updateLocalField('precioVenta', e.target.value)}
                      />
                    ) : (
                      <div className="estado-chip chip-soft ms-2">{formatCurrency(data.precioVenta)}</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Descuento (%)</label>
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={data.descuento ?? 0}
                        onChange={(e) => updateLocalField('descuento', e.target.value)}
                      />
                    ) : (
                      <div className="estado-chip chip-soft ms-2">{formatNumber(data.descuento ?? 0)}%</div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Stock disponible (Uds.)</label>
                    <div className="estado-chip chip-soft ms-2">{formatNumber(data.cantidadTotalMinima)}</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label lote-detail-label">Estado</label>
                    <div className={`estado-chip ${data.activo ? 'chip-soft' : 'chip-inactive'} ms-2`}>{data.activo ? 'Activo' : 'Inactivo'}</div>
                  </div>
                </div>
              )}
            </div>
            {editable && data && hasChanges && (
              <div className="inventory-modal-footer">
                <ActionButton
                  variant="outline-danger"
                  icon="bi bi-x-circle"
                  text="Cancelar"
                  type="button"
                  onClick={closeLoteModal}
                />
                <ActionButton
                  variant="primary"
                  icon="bi bi-check2-circle"
                  text="Guardar cambios"
                  type="submit"
                  loading={loading}
                  disabled={loading}
                />
              </div>
            )}
          </form>
        </div>
      </div>
    );
  };

  const renderDeactivateModal = () => {
    if (!deactivateModal.open) return null;
    return (
      <div className="inventory-modal-backdrop" onClick={closeDeactivateModal}>
        <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
          <form
            className="inventory-lote-form"
            onSubmit={(e) => {
              e.preventDefault();
              confirmDeactivate();
            }}
          >
            <div className="inventory-modal-header">
              <div className="inventory-modal-title-badge">
                <i className="bi bi-exclamation-octagon"></i>
                <span>Desactivar lote</span>
              </div>
              <button type="button" className="btn-close" onClick={closeDeactivateModal}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="inventory-modal-body">
              <p>
                Desea desactivar el lote <strong>{deactivateModal.lote?.numeroLote}</strong> del producto{' '}
                <strong>{deactivateModal.lote?.producto}</strong>?
              </p>
              <div className="mb-3">
                <label className="form-label">
                  Motivo <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Ej. Lote vencido, error en recepción..."
                  value={deactivateModal.motivo}
                  onChange={(e) =>
                    setDeactivateModal((prev) => ({ ...prev, motivo: e.target.value, error: '' }))
                  }
                  disabled={deactivateModal.loading}
                />
              </div>
              {deactivateModal.error && <div className="alert alert-danger">{deactivateModal.error}</div>}
            </div>
            <div className="inventory-modal-footer">
              <ActionButton
                variant="outline-danger"
                icon="bi bi-x-circle"
                text="Cancelar"
                type="button"
                onClick={closeDeactivateModal}
                disabled={deactivateModal.loading}
              />
              <ActionButton
                variant="danger"
                icon="bi bi-shield-exclamation"
                text={deactivateModal.loading ? "Desactivando..." : "Desactivar"}
                type="submit"
                loading={deactivateModal.loading}
                disabled={deactivateModal.loading}
              />
            </div>
          </form>
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
            <button className="btn-close" onClick={closeCompraModal}>
              <i className="bi bi-x-lg"></i>
            </button>
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
                {(() => {
                  const items = Array.isArray(data.items) ? data.items : [];
                  const columns = [
                    {
                      name: 'Producto',
                      selector: (r) => r.producto,
                      sortable: true,
                      wrap: true,
                      grow: 2,
                    },
                    { name: 'Lote', selector: (r) => r.numeroLote || '—', sortable: true, wrap: true },
                    { name: 'Vencimiento', selector: (r) => r.fechaVencimiento, sortable: true, cell: (r) => formatDate(r.fechaVencimiento), width: '140px' },
                    { name: 'Empaques', selector: (r) => r.cantidadEmpaques, sortable: true, cell: (r) => formatNumber(r.cantidadEmpaques), right: true, width: '120px' },
                    { name: 'Unid. por emp.', selector: (r) => r.factorUnidad ?? r.cantidadUnidadesMinimas, sortable: true, cell: (r) => formatNumber(r.factorUnidad ?? r.cantidadUnidadesMinimas), right: true, width: '130px' },
                    { name: 'Precio costo', selector: (r) => r.precioCosto, sortable: true, cell: (r) => formatCurrency(r.precioCosto), right: true, width: '140px' },
                    { name: 'Subtotal', selector: (r) => r.cantidadEmpaques * r.precioCosto, sortable: true, cell: (r) => formatCurrency((r.cantidadEmpaques || 0) * (r.precioCosto || 0)), right: true, width: '140px' },
                  ];
                  return (
                    <div className="lista-compra-detalle-scroll">
                      <DataTable
                        columns={columns}
                        data={items}
                        highlightOnHover
                        striped
                        responsive
                        persistTableHead
                        noDataComponent="Sin items en la compra."
                        customStyles={{
                          cells: { style: { whiteSpace: 'normal' } },
                          headCells: { style: { whiteSpace: 'normal', fontWeight: 600 } },
                        }}
                      />
                    </div>
                  );
                })()}
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
      wrap: true,
      cell: (row) => (
        <div>
          <div className="fw-semibold">{row.nombre}</div>
        </div>
      ),
    },
    {
      name: 'Categora',
      selector: (row) => row.categoria || '—',
      sortable: true,
      grow: 1,
      wrap: true,
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
        <span className={`estado-chip ${row.activo ? 'chip-success' : 'chip-inactive'}`}>
          <i className={`bi ${row.activo ? 'bi-check-circle-fill' : 'bi-dash-circle'}`} />
          {row.estado}
        </span>
      ),
    },
    {
      name: 'Acciones',
      button: true,
      width: '140px',
      cell: (row) => (
        <div>
          <ActionButton
            variant="outline-primary-compact"
            icon="bi bi-eye"
            text="Ver lotes"
            type="button"
            onClick={() => handleOpenProductLotsModal(row)}
            title="Ver lotes"
          />
        </div>
      ),
    },
  ], [handleOpenProductLotsModal]);

  const lotesColumns = useMemo(() => [
    {
      name: 'Producto',
      selector: (row) => row.producto,
      sortable: true,
      grow: 2,
      wrap: true,
      cell: (row) => (
        <div>
          <div className="fw-semibold">{row.producto}</div>
          {row.categoria && <div className="text-muted small">{row.categoria}</div>}
        </div>
      ),
    },
    { name: 'Lote', selector: (row) => row.numeroLote, sortable: true, wrap: true },
    {
      name: 'Vencimiento',
      selector: (row) => row.fechaVencimiento,
      sortable: true,
      width: '180px',
      cell: (row) => (
        <div className="d-flex align-items-center justify-content-between flex-nowrap" style={{ gap: 5 }}>
          <span>{formatDate(row.fechaVencimiento)}</span>
          {row.alertaVencimiento && (
            <span
              className={`estado-chip ms-2 ${row.alertaVencimiento === 'critico'
                  ? 'chip-danger'
                  : row.alertaVencimiento === 'aviso'
                    ? 'chip-warning'
                    : 'chip-danger'
                }`}
              title={row.alertaVencimiento === 'vencido' ? 'Vencido' : (row.alertaVencimiento === 'critico' ? 'Próximo a vencer (<=30 días)' : 'Próximo a vencer (<=60 días)')}
            >
              {row.alertaVencimiento === 'vencido' ? (
                <>
                  <i className="bi bi-x-octagon-fill" />
                  Vencido
                </>
              ) : row.alertaVencimiento === 'critico' ? (
                <>
                  <i className="bi bi-exclamation-triangle-fill" />
                  30d
                </>
              ) : (
                <>
                  <i className="bi bi-exclamation-circle-fill" />
                  60d
                </>
              )}
            </span>
          )}
        </div>
      ),
    },
    {
      name: 'Stock (unidades)',
      selector: (row) => row.cantidadTotalMinima,
      sortable: true,
      right: true,
      width: '170px',
      cell: (row) => <span>{formatNumber(row.cantidadTotalMinima)}</span>,
    },
    {
      name: 'Precio venta',
      selector: (row) => row.precioVenta,
      sortable: true,
      right: true,
      width: '150px',
      cell: (row) => <span>{formatCurrency(row.precioVenta)}</span>,
    },
    {
      name: 'Estado',
      selector: (row) => row.estado,
      sortable: true,
      width: '140px',
      cell: (row) => (
        row.activo ? (
          <span className="estado-chip chip-success" title="Activo">
            <i className="bi bi-check-circle-fill" />
            Activo
          </span>
        ) : (
          <span className="estado-chip chip-inactive" title="Inactivo">
            <i className="bi bi-x-circle-fill" />
            Inactivo
          </span>
        )
      ),
    },
    {
      name: 'Acciones',
      button: true,
      allowOverflow: true,
      width: '170px',
      cell: (row) => (
        <div className="table-action-group btn-group btn-group-sm cursor-selectable">
          <button className="btn btn-outline-secondary cursor-selectable" onClick={() => openLoteModal('view', row)} title="Ver detalle">
            <i className="bi bi-eye" />
          </button>
          <button className="btn btn-outline-primary cursor-selectable" onClick={() => openLoteModal('edit', row)} title="Editar lote">
            <i className="bi bi-pencil" />
          </button>
          <button className="btn btn-outline-danger cursor-selectable" onClick={() => openDeactivateModal(row)} disabled={!row.activo} title="Desactivar lote">
            <i className="bi bi-dash-circle" />
          </button>
        </div>
      ),
    },
  ], [openLoteModal, openDeactivateModal]);

  return (
    <div className="inventario-page container-fluid container py-3">
      <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
        <h3 className="visually-hidden"><i className="bi bi-box-seam me-2" />Inventario</h3>
        <TabBar
          tabs={tabOptions}
          active={activeTab}
          onSelect={handleChangeTab}
          className="ms-auto"
          ariaLabel="Secciones de inventario"
        />
      </div>

      {activeTab === 'resumen' && (
        <div>
          {dashboardLoading && <div className="alert alert-info">Cargando resumen...</div>}
          {dashboardError && <div className="alert alert-danger">{dashboardError}</div>}
          {dashboard && (
            <div className="row g-3">
              <div className="col-lg-4 col-md-12">
                <div className="row g-3 mb-4">
                  <div className="col-12 col-sm-6">
                    <button className="inventory-card-button w-100 h-100 cursor-selectable" onClick={() => openCardModal('valor')}>
                      <StatsCard
                        title="Valor inventario"
                        value={formatCurrency(resumenMetrics?.inventoryValue?.total || 0)}
                        icon="bi-cash-stack"
                        color="primary"
                      />
                    </button>
                  </div>
                  <div className="col-12 col-sm-6">
                    <button className="inventory-card-button w-100 h-100 cursor-selectable" onClick={() => openCardModal('vencimientos')}>
                      <StatsCard
                        title="Próximos a vencer"
                        value={formatNumber(resumenMetrics?.expiringLots?.total || 0)}
                        icon="bi-exclamation-triangle"
                        color="warning"
                        subtitle={
                          <span className="stats-card-chip stats-card-chip-warning">
                            <i className="bi bi-clock-fill" aria-hidden="true"></i>
                            <span className="stats-card-chip-text">
                              <strong>&lt;30d:</strong> {formatNumber(resumenMetrics?.expiringLots?.lessThan30 || 0)}
                              <span className="mx-1 text-muted">/</span>
                              <strong>31-60d:</strong> {formatNumber(resumenMetrics?.expiringLots?.between31And60 || 0)}
                            </span>
                          </span>
                        }
                      />
                    </button>
                  </div>
                  <div className="col-12 col-sm-6">
                    <button className="inventory-card-button w-100 h-100 cursor-selectable" onClick={() => openCardModal('bajoStock')}>
                      <StatsCard
                        title="Productos con stock bajo"
                        value={formatNumber(resumenMetrics?.lowStock?.total || 0)}
                        icon="bi-arrow-down-short"
                        color="danger"
                      />
                    </button>
                  </div>
                  <div className="col-12 col-sm-6">
                    <button className="inventory-card-button w-100 h-100 cursor-selectable" onClick={() => openCardModal('activos')}>
                      <StatsCard
                        title="Productos activos"
                        value={formatNumber(resumenMetrics?.activeProducts?.total || 0)}
                        icon="bi-check-circle"
                        color="success"
                      />
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-lg-8 col-md-12">
                <div className="card shadow-sm">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
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
                    <div className="lista-productos-scroll">
                      <DataTable
                        columns={productColumns}
                        data={filteredProducts}
                        pagination
                        paginationPerPage={5}
                        paginationRowsPerPageOptions={[5, 10, 30, 50]}
                        highlightOnHover
                        striped
                        responsive
                        fixedHeader
                        fixedHeaderScrollHeight="50vh"
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
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'lotes' && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-2 lotes-toolbar">
              <div className="w-auto">
                <input
                  type="search"
                  className="form-control form-control-sm lotes-search-input"
                  placeholder="Buscar por producto o lote..."
                  value={loteFilters.buscar}
                  onChange={(e) => handleChangeFilters('buscar', e.target.value)}
                />
              </div>
              <div className="d-flex gap-2 align-items-center">
                <select
                  className="form-select form-select-sm lotes-estado-select"
                  value={loteFilters.estado}
                  onChange={(e) => handleChangeFilters('estado', e.target.value)}
                >
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                  <option value="todos">Todos</option>
                </select>
                <div className="form-check lotes-chip-wrapper">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="filterProximos"
                    checked={loteFilters.proximos}
                    onChange={(e) => handleChangeFilters('proximos', e.target.checked)}
                  />
                  <label className="form-check-label cursor-selectable" htmlFor="filterProximos">
                    Próximos a vencer
                  </label>
                  <span className="lotes-chip-badge cursor-selectable">≤60 días</span>
                </div>
              </div>
            </div>
            {lotesLoading && <div className="alert alert-info">Cargando lotes...</div>}
            {lotesError && <div className="alert alert-danger">{lotesError}</div>}
            <DataTable
              columns={lotesColumns}
              data={lotes}
              pagination
              paginationServer={false}
              paginationTotalRows={lotes.length}
              paginationPerPage={lotesPageSize}
              paginationDefaultPage={lotesPage}
              paginationResetDefaultPage={lotesPaginationReset}
              onChangePage={handleLotesPageChange}
              onChangeRowsPerPage={(newPerPage) => handleLotesPageSizeChange(newPerPage)}
              paginationRowsPerPageOptions={[5, 10, 30, 50]}
              paginationComponentOptions={{ rowsPerPageText: 'Filas:', rangeSeparatorText: 'de' }}
              highlightOnHover
              striped
              responsive
              persistTableHead
              fixedHeader
              fixedHeaderScrollHeight="50vh"
              progressPending={lotesLoading}
              progressComponent={<div className="py-3 text-center mb-0">Cargando lotes...</div>}
              noDataComponent="No hay lotes que coincidan con los filtros."
              customStyles={lotesTableStyles}
            />
          </div>
        </div>
      )}

      {activeTab === 'compras' && (
        <div className="row g-3">
          {renderConfirmCompraModal()}
          <div className="col-12 col-xxl-7">
            <div className="card shadow-sm compras-form-card mx-auto">
              <div className="card-body compras-form-panel">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Registrar compra</h5>
                  <div className="registrado-chip" title={user ? `${user.username}` : ''}>
                    <i className="bi bi-person-check-fill" />
                    <span>
                      Registrado por: {user ? (([user.nombres, user.apellidos].filter(Boolean).join(' ') || user.username) +
                        (user.username && (([user.nombres, user.apellidos].filter(Boolean).join(' ') || user.username) !== user.username) ? ` (${user.username})` : '')) : '—'}
                    </span>
                  </div>
                </div>
                <form onSubmit={handleSubmitCompra} noValidate>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Proveedor <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select ${purchaseFormErrors.proveedor ? 'is-invalid' : ''}`}
                        value={selectedProveedor}
                        onChange={(e) => {
                          setSelectedProveedor(e.target.value);
                          if (purchaseFormErrors.proveedor) setPurchaseFormErrors((prev) => ({ ...prev, proveedor: '' }));
                        }}
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
                      <FieldError error={purchaseFormErrors.proveedor} />
                    </div>
                  </div>

                  <div className="purchase-items">
                    {purchaseItems.map((item, index) => {
                      const isNuevoLote = item.loteSeleccion !== 'existente' || !item.loteId;
                      const marcaError = (purchaseItemErrors[item.id] || {}).marcaId;
                      return (
                        <div className="card mt-3 border-0 shadow-sm purchase-item-card" key={item.id}>
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-2">
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <div className="producto-chip">
                                  <i className="bi bi-box-seam" />
                                  <span>Producto #{index + 1}</span>
                                </div>
                                {item.loteSeleccion === 'existente' && item.loteId && (
                                  <span className="lote-existente-chip lote-chip-success">
                                    Lote: <strong className="ms-1">{item.numeroLote}</strong>
                                  </span>
                                )}
                              </div>
                              {purchaseItems.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger cursor-selectable"
                                  title="Quitar producto"
                                  aria-label="Quitar producto"
                                  onClick={() => handleRemoveCompraItem(item.id)}
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              )}
                            </div>

                            <div className="row g-1">
                              <div className="col-md-4">
                                <label className="form-label">
                                  Buscar producto <span className="text-danger">*</span>
                                </label>
                                <ProductSelector onSelect={(producto) => handleSelectProducto(item.id, producto)} />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).producto} />
                              </div>
                              <div className="col-md-8">
                                <label className="form-label">Lote</label>
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
                                        marcaId: '',
                                        marcaNombre: '',
                                      });
                                    } else {
                                      handleSelectLoteExistente(item.id, value);
                                    }
                                  }}
                                  disabled={!item.productoId || item.lotesDisponibles.length === 0}
                                >
                                  <option value="">Nuevo lote</option>
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

                              {isNuevoLote ? (
                                <>
                                  <div className="col-md-4">
                                    <label className="form-label">
                                      Número de lote <span className="text-danger">*</span>
                                    </label>
                                    <input
                                      className={`form-control ${(purchaseItemErrors[item.id] || {}).numeroLote ? 'is-invalid' : ''
                                        }`}
                                      value={item.numeroLote}
                                      onChange={(e) => updateCompraItem(item.id, { numeroLote: e.target.value })}
                                    />
                                    <FieldError error={(purchaseItemErrors[item.id] || {}).numeroLote} />
                                  </div>
                                </>
                              ) : null}
                              <div className="col-md-4">
                                <label className="form-label">
                                  Marca {isNuevoLote && <span className="text-danger">*</span>}
                                </label>
                                {isNuevoLote ? (
                                  <select
                                    className={`form-select ${marcaError ? 'is-invalid' : ''}`}
                                    value={item.marcaId}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const selected = marcas.find((marca) => String(marca.marcaId) === value);
                                      updateCompraItem(item.id, {
                                        marcaId: value,
                                        marcaNombre: selected?.nombre || '',
                                      });
                                    }}
                                    disabled={marcasLoading || marcas.length === 0}
                                  >
                                    <option value="">Seleccione marca...</option>
                                    {marcas.map((marca) => (
                                      <option key={marca.marcaId} value={marca.marcaId}>
                                        {marca.nombre}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input className="form-control" value={item.marcaNombre || 'Sin marca'} disabled />
                                )}
                                <FieldError error={marcaError} />
                                {isNuevoLote && marcasLoading && (
                                  <small className="text-muted">Cargando marcas...</small>
                                )}
                                {isNuevoLote && marcasError && <small className="text-danger">{marcasError}</small>}
                              </div>
                              {isNuevoLote ? (
                                <div className="col-md-4">
                                  <label className="form-label">
                                    Fecha de vencimiento <span className="text-danger">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    className={`form-control ${(purchaseItemErrors[item.id] || {}).fechaVencimiento ? 'is-invalid' : ''
                                      }`}
                                    value={item.fechaVencimiento}
                                    onChange={(e) => updateCompraItem(item.id, { fechaVencimiento: e.target.value })}
                                  />
                                  <FieldError error={(purchaseItemErrors[item.id] || {}).fechaVencimiento} />
                                </div>
                              ) : null}

                              <div className="col-md-2">
                                <label className="form-label">
                                  Precio costo <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`form-control ${(purchaseItemErrors[item.id] || {}).precioCosto ? 'is-invalid' : ''
                                    }`}
                                  value={item.precioCosto}
                                  onChange={(e) => updateCompraItem(item.id, { precioCosto: e.target.value })}
                                  disabled={item.loteSeleccion === 'existente' && item.loteId}
                                />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).precioCosto} />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label">
                                  Precio venta <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`form-control ${(purchaseItemErrors[item.id] || {}).precioVenta ? 'is-invalid' : ''
                                    }`}
                                  value={item.precioVenta}
                                  onChange={(e) => updateCompraItem(item.id, { precioVenta: e.target.value })}
                                  disabled={item.loteSeleccion === 'existente' && item.loteId}
                                />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).precioVenta} />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label">Descuento (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`form-control ${(purchaseItemErrors[item.id] || {}).descuento ? 'is-invalid' : ''
                                    }`}
                                  value={item.descuento}
                                  onChange={(e) => updateCompraItem(item.id, { descuento: e.target.value })}
                                  disabled={item.loteSeleccion === 'existente' && item.loteId}
                                />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).descuento} />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label">
                                  Empaques <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className={`form-control ${(purchaseItemErrors[item.id] || {}).cantidadEmpaques ? 'is-invalid' : ''
                                    }`}
                                  value={item.cantidadEmpaques}
                                  onChange={(e) => updateCompraItem(item.id, { cantidadEmpaques: e.target.value })}
                                />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).cantidadEmpaques} />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label">
                                  Cant. x empq <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  className={`form-control ${(purchaseItemErrors[item.id] || {}).cantidadUnidadesMinimas ? 'is-invalid' : ''
                                    }`}
                                  value={item.cantidadUnidadesMinimas}
                                  onChange={(e) =>
                                    updateCompraItem(item.id, { cantidadUnidadesMinimas: e.target.value })
                                  }
                                  disabled={item.loteSeleccion === 'existente'}
                                />
                                <FieldError error={(purchaseItemErrors[item.id] || {}).cantidadUnidadesMinimas} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Mensajes globales reemplazados por Toast */}

                  <div className="d-flex justify-content-between align-items-center">
                    <ActionButton
                      variant="outline-primary"
                      icon="bi bi-plus-lg"
                      text="Agregar producto"
                      type="button"
                      onClick={handleAddCompraItem}
                    />
                    <ActionButton
                      variant="primary"
                      icon="bi bi-save"
                      text={creatingCompra ? "Guardando..." : "Registrar compra"}
                      type="submit"
                      loading={creatingCompra}
                      disabled={creatingCompra}
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-12 col-xxl-5">
            <div className="card compras-panel shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <h5 className="mb-0">Historial de compras</h5>
                </div>
                <div className="d-flex align-items-center justify-content-end flex-wrap gap-2 mb-3">
                  <div className="inventory-search-wrapper">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Buscar..."
                      value={comprasSearch}
                      onChange={(e) => setComprasSearch(e.target.value)}
                      style={{ maxWidth: '320px' }}
                    />
                  </div>
                </div>
                {comprasError && <div className="alert alert-danger">{comprasError}</div>}
                <div>
                  <DataTable
                    columns={comprasColumns}
                    data={filteredCompras}
                    pagination
                    paginationServer={false}
                    paginationTotalRows={filteredCompras.length}
                    paginationPerPage={comprasPageSize}
                    paginationDefaultPage={comprasPage}
                    paginationResetDefaultPage={comprasPaginationReset}
                    onChangePage={handleComprasPageChange}
                    onChangeRowsPerPage={(newPerPage) => handleComprasPageSizeChange(newPerPage)}
                    paginationRowsPerPageOptions={[5, 10, 30, 50]}
                    paginationComponentOptions={{ rowsPerPageText: 'Filas:', rangeSeparatorText: 'de' }}
                    highlightOnHover
                    striped
                    responsive
                    persistTableHead
                    fixedHeader
                    fixedHeaderScrollHeight="50vh"
                    progressPending={comprasLoading}
                    progressComponent={<div className="py-3 text-center mb-0">Cargando compras...</div>}
                    noDataComponent="An no hay compras registradas."
                  />
                </div>
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
      <Toast key={toastKey} message={toastMsg} type={toastType} />
    </div>
  );
}


