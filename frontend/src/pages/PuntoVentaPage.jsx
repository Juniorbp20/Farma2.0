// src/pages/PuntoVentaPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './PuntoVentaPage.css';
import { getClientes, getClienteById } from '../services/clientesService';
import { buscarProductos } from '../services/productsService';
import { getLotes } from '../services/inventoryService';
import { crearVenta, getVentaPdf, getVenta, aplicarDevolucion, getVentas, getHistorialDia } from '../services/salesService';
import TabBar from '../components/TabBar';
import ActionButton from '../components/ActionButton';
import CustomButton from '../components/recursos/CustomButton';
import Toast from '../components/recursos/Toast';
import { getUser } from '../services/authService';
import { buildPermissions } from '../utils/permissions';
import DataTable from 'react-data-table-component';

function number(val, d = 2) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
}

function formatMoney(amount, currencySymbol = 'RD$') {
    return `${currencySymbol} ${Number(amount || 0).toFixed(2)}`;
}

function fixEncoding(value) {
    if (typeof value !== 'string') return value;
    const cleaned = value
        .replace(/\u00A0/g, ' ')
        .replace(/\u00C2/g, '')
        .replace(/\u00C3\u0083/g, 'A')
        .replace(/\s+/g, ' ')
        .trim();
    try {
        return decodeURIComponent(escape(cleaned));
    } catch {
        return cleaned;
    }
}

function sanitizeProducto(p) {
    return {
        ...p,
        Nombre: fixEncoding(p?.Nombre),
        NombreProducto: fixEncoding(p?.NombreProducto),
        Presentacion: fixEncoding(p?.Presentacion),
        Categoria: fixEncoding(p?.Categoria),
        Marca: fixEncoding(p?.Marca),
    };
}

function LineaItem({ item, onChange, onRemove, currencySymbol }) {
    const lotesOrdenados = [...(item.lotes || [])].sort((a, b) => {
        const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER;
        const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER;
        if (fa !== fb) return fa - fb;
        return (a.loteId || 0) - (b.loteId || 0);
    });
    const lotesFiltrados = item.marcaId
        ? lotesOrdenados.filter((l) => String(l.marcaId || '') === String(item.marcaId))
        : lotesOrdenados;
    const loteSel = lotesFiltrados.find((l) => l.loteId === item.loteId) || lotesFiltrados[0] || null;
    const factor = Math.max(1, Number(loteSel?.cantidadUnidadesMinimas || item.factorUnidad || 1));
    const stockEmp = loteSel ? Math.max(0, Number(loteSel.cantidadEmpaques || 0)) : 0;
    const stockTotal = loteSel
        ? Math.max(0, Number(loteSel.totalUnidadesMinimas ?? loteSel.cantidadTotalMinima ?? (stockEmp * factor)))
        : 0;
    const modo = item.modo === 'detalle' ? 'detalle' : 'empaque';
    const cantEmp = Number(item.cantEmpaques || 0);
    const cantUni = Number(item.cantUnidadesMinimas || 0);

    const precioEmpaqueBase = loteSel ? Number(loteSel.precioVenta || loteSel.precioUnitarioVenta || 0) : 0;
    const rawDesc = Number(loteSel?.descuento || loteSel?.porcentajeDescuentoEmpaque || 0);
    const descPct = rawDesc >= 1 ? rawDesc / 100 : rawDesc;
    const descuentoEmp = modo === 'empaque' ? Math.min(1, Math.max(0, descPct)) : 0;
    const precioEmpaqueAplicado = precioEmpaqueBase * (1 - descuentoEmp);
    const precioUnidadAplicada =
        factor > 0
            ? (modo === 'empaque' ? precioEmpaqueAplicado / factor : precioEmpaqueBase / factor)
            : precioEmpaqueBase;
    const precioMostrar = modo === 'empaque' ? precioEmpaqueAplicado : precioUnidadAplicada;
    const impuestoPct = Number(item.impuesto ?? loteSel?.impuesto ?? loteSel?.porcentajeImpuesto ?? 0);

    const unidades = modo === 'empaque' ? cantEmp * factor : cantUni;
    const subtotal = number(unidades * precioUnidadAplicada, 2);
    const imp = number(subtotal * (impuestoPct / 100), 2);

    const maxEmp = stockEmp;
    const maxUni = stockTotal;
    const marcasDisponibles = Array.from(
        new Map(
            lotesOrdenados.map((l) => [
                String(l.marcaId || ''),
                { id: l.marcaId || '', nombre: l.marcaNombre || l.marcaId || 'Sin marca' },
            ])
        ).values()
    );

    const chipActive = modo === 'empaque';
    const chipClass = `chip-modo ${chipActive ? 'chip-modo--active' : ''}`;

    return (
        <tr>
            <td>
                <div className="fw-semibold">{item.nombre}</div>
                <div className="text-muted small">{item.presentacion}</div>
            </td>
            <td style={{ width: 170 }}>
                <select
                    className="form-select form-select-sm"
                    value={item.marcaId ?? ''}
                    onChange={(e) => {
                        const nuevaMarca = e.target.value;
                        const candidatos = lotesOrdenados.filter((l) => String(l.marcaId || '') === nuevaMarca);
                        const nextLote = candidatos[0] || lotesOrdenados[0] || null;
                        onChange({
                            ...item,
                            marcaId: nuevaMarca,
                            loteId: nextLote ? nextLote.loteId : null,
                            factorUnidad: nextLote ? Math.max(1, Number(nextLote.cantidadUnidadesMinimas || 1)) : item.factorUnidad,
                        });
                    }}
                    disabled={!lotesOrdenados.length}
                >
                    {!lotesOrdenados.length && <option value="">Sin lotes</option>}
                    {marcasDisponibles.map((m) => (
                        <option key={m.id || 'sin-marca'} value={m.id}>{m.nombre}</option>
                    ))}
                </select>
            </td>
            <td>
                <select className="form-select form-select-sm" value={item.loteId || ''} disabled={!lotesFiltrados.length}
                    onChange={(e) => {
                        const loteId = Number(e.target.value);
                        const seleccionado = lotesFiltrados.find((l) => l.loteId === loteId);
                        onChange({
                            ...item,
                            loteId,
                            factorUnidad: seleccionado ? Number(seleccionado.cantidadUnidadesMinimas || 1) : item.factorUnidad,
                        });
                    }}>
                    {lotesFiltrados.length === 0 && <option value="">Sin lotes para la marca</option>}
                    {lotesFiltrados.map((l) => (
                        <option key={l.loteId} value={l.loteId}>
                            {(l.numeroLote || `Lote ${l.loteId}`)}{l.fechaVencimiento ? ` - vence ${new Date(l.fechaVencimiento).toLocaleDateString()}` : ''}
                        </option>
                    ))}
                </select>
            </td>
            <td style={{ width: 210 }}>
                <div className="d-flex flex-column align-items-center gap-1">
                    <div className="d-flex align-items-center gap-2">
                        <div className={chipClass}>
                            <div className="form-check form-switch m-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`modo-${item.lineId}`}
                                    checked={modo === 'empaque'}
                                    onChange={(e) => onChange({ ...item, modo: e.target.checked ? 'empaque' : 'detalle' })}
                                />
                            </div>
                            <label className="small mb-0" htmlFor={`modo-${item.lineId}`}>
                                {modo === 'empaque' ? 'Empaque' : 'Detalle'}
                            </label>
                        </div>
                        <div
                            className={`badge ${descuentoEmp > 0 ? 'bg-success-subtle text-success fw-semibold' : 'bg-light text-muted'} px-2 py-1 border`}
                            title="Descuento por empaque aplicado desde el lote"
                            style={{ minWidth: 70, textAlign: 'center', fontSize: '0.78rem' }}
                        >
                            Desc: {(descuentoEmp * 100).toFixed(0)}%
                        </div>
                    </div>
                    {modo === 'empaque' ? (
                        <input type="number" className="form-control form-control-sm text-center input-cant" min={0} max={maxEmp} value={cantEmp} disabled={!lotesFiltrados.length}
                            onChange={(e) => {
                                const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                onChange({ ...item, cantEmpaques: Math.min(v, maxEmp), cantUnidadesMinimas: 0 });
                            }} />
                    ) : (
                        <input type="number" className="form-control form-control-sm text-center input-cant" min={0} max={maxUni} value={cantUni} disabled={!lotesFiltrados.length}
                            onChange={(e) => {
                                const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                onChange({ ...item, cantUnidadesMinimas: Math.min(v, maxUni), cantEmpaques: 0 });
                            }} />
                    )}
                </div>
            </td>
            <td>
                <div className="small text-muted">
                    <div>Stock: {stockEmp} empaques (1:{factor})</div>
                    <div>{stockTotal} unidades min.</div>
                </div>
            </td>
            <td className="text-end">{formatMoney(precioMostrar, currencySymbol)}</td>
            <td className="text-end">{formatMoney(imp, currencySymbol)}</td>
            <td className="text-end">{formatMoney(subtotal + imp, currencySymbol)}</td>
            <td className="text-center">
                <button className="btn btn-sm btn-outline-danger delete-btn" onClick={() => onRemove(item)} title="Quitar"><i className="bi bi-trash"></i></button>
            </td>
        </tr>
    );
}

export default function PuntoVentaPage({ user, onNavigate, initialTab = 'venta' }) {
    const [clientes, setClientes] = useState([]);
    const [clienteSel, setClienteSel] = useState(null);
    const [clienteTerm, setClienteTerm] = useState('');
    const [clienteSug, setClienteSug] = useState([]);
    const [estado, setEstado] = useState('Pagada');
    const [formaPago, setFormaPago] = useState('Efectivo');
    const [montoRecibido, setMontoRecibido] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab || 'venta');

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
    const [currencySymbol, setCurrencySymbol] = useState(() => sessionStorage.getItem('currencySymbol') || 'RD$');
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState('success');
    const [toastKey, setToastKey] = useState(Date.now());

    const triggerToast = (type, message) => {
        setToastType(type);
        setToastMsg(message);
        setToastKey(Date.now());
    };
    const [devFrom, setDevFrom] = useState('');
    const [devTo, setDevTo] = useState('');
    const [devFacturaNo, setDevFacturaNo] = useState('');
    const [devVentas, setDevVentas] = useState([]);
    const [devLoading, setDevLoading] = useState(false);
    const [, setDevError] = useState('');
    const [, setDevNotaCredito] = useState(null);
    const [devDetalle, setDevDetalle] = useState({ open: false, ventaId: null, cab: null, items: [], err: '', msg: '' });
    const [devResumen, setDevResumen] = useState({ open: false, ventaId: null, cab: null, items: [], err: '' });

    const [reimpNo, setReimpNo] = useState('');
    const [reimpData, setReimpData] = useState(null);
    const [reimpLoading, setReimpLoading] = useState(false);
    const [reimpError, setReimpError] = useState('');

    const [histFecha, setHistFecha] = useState(() => new Date().toISOString().slice(0, 10));
    const [histLoading, setHistLoading] = useState(false);
    const [histError, setHistError] = useState('');
    const [histData, setHistData] = useState(null);

    const perms = useMemo(() => buildPermissions(user || getUser()), [user]);
    const canMovsInventario = perms.can('inventario:read');

    const tabOptions = useMemo(() => {
        const base = [
            { value: 'venta', label: 'Venta', icon: 'bi bi-receipt' },
            { value: 'Devoluciones', label: 'Devoluciones', icon: 'bi bi-arrow-counterclockwise' },
        ];
        if (canMovsInventario) {
            base.push({ value: 'otras', label: 'Otras opciones', icon: 'bi bi-sliders' });
        }
        return base;
    }, [canMovsInventario]);

    const handleTabSelect = (key) => {
        setActiveTab(key);
    };

    const inputBusquedaRef = useRef(null);
    const lineIdRef = useRef(0);

    useEffect(() => { (async () => { try { setClientes(await getClientes()); } catch { } })(); }, []);
    useEffect(() => {
        const stored = sessionStorage.getItem('currencySymbol');
        if (stored) setCurrencySymbol(stored);
    }, []);

    useEffect(() => {
        if (!ok) return undefined;
        const t = setTimeout(() => setOk(null), 5000);
        return () => clearTimeout(t);
    }, [ok]);

    useEffect(() => {
        const term = (clienteTerm || '').trim().toLowerCase();
        if (!term) { setClienteSug([]); return; }
        const matches = clientes
            .filter(c => {
                const full = `${c.Nombres || ''} ${c.Apellidos || ''}`.toLowerCase();
                const doc = `${c.Documento || ''}`.toLowerCase();
                return full.includes(term) || doc.includes(term);
            })
            .slice(0, 8);
        setClienteSug(matches);
    }, [clienteTerm, clientes]);

    const estadoOpciones = useMemo(() => {
        if (formaPago === 'Efectivo') return ['Pagada', 'Pendiente'];
        if (formaPago === 'Tarjeta') return ['Pagada'];
        return ['Credito'];
    }, [formaPago]);

    useEffect(() => {
        if (!estadoOpciones.includes(estado)) {
            setEstado(estadoOpciones[0]);
        }
    }, [estadoOpciones, estado]);

    const canPrint = (() => {
        const r = String(user?.rol || '').toLowerCase();
        return r.includes('admin') || r.includes('cajero');
    })();
    const canProcessDevol = useMemo(() => {
        const r = String(user?.rol || '').toLowerCase();
        return r.includes('admin') || r.includes('cajero');
    }, [user]);

    useEffect(() => {
        let cancel = false;
        const run = async () => {
            const q = busqueda.trim();
            if (!q) { setSugerencias([]); return; }
            setLoadingSug(true);
            try {
                const data = await buscarProductos(q);
                if (!cancel) {
                    const lista = Array.isArray(data) ? data : [];
                    const anotados = lista.map((p) => {
                        const prod = sanitizeProducto(p);
                        const stockVal = Number(p.Stock ?? p.StockActual ?? p.stock_actual ?? 0);
                        const sinStock = !Number.isFinite(stockVal) || stockVal <= 0;
                        return { ...prod, _sinStock: sinStock };
                    });
                    setSugerencias(anotados);
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

    useEffect(() => {
        if (activeTab !== 'otras') return;
        if (!histData && !histLoading) histBuscar(histFecha);
    }, [activeTab]);

    const calcularTotales = useMemo(() => {
        let subtotal = 0;
        let impuestoTotal = 0;
        items.forEach((it) => {
            const loteSel = it.lotes.find((l) => l.loteId === it.loteId);
            if (!loteSel) return;
            const factor = Math.max(1, Number(loteSel.cantidadUnidadesMinimas || it.factorUnidad || 1));
            const precioEmpaqueBase = Number(loteSel.precioVenta || loteSel.precioUnitarioVenta || 0);
            const rawDesc = Number(loteSel.descuento || loteSel.porcentajeDescuentoEmpaque || 0);
            const descPct = rawDesc >= 1 ? rawDesc / 100 : rawDesc;
            const descEmp = it.modo === 'empaque' ? Math.min(1, Math.max(0, descPct)) : 0;
            const precioEmpaque = precioEmpaqueBase * (1 - descEmp);
            const precioUnidadAplicada =
                factor > 0
                    ? (it.modo === 'empaque' ? precioEmpaque / factor : precioEmpaqueBase / factor)
                    : precioEmpaqueBase;
            const impuesto = Number(it.impuesto ?? loteSel.impuesto ?? 0);
            const unidades = it.modo === 'empaque'
                ? Number(it.cantEmpaques || 0) * factor
                : Number(it.cantUnidadesMinimas || 0);
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

    function obtenerLoteSeleccionado(it) {
        return it.lotes.find((l) => l.loteId === it.loteId) || null;
    }

    function unidadesSolicitadas(it, loteSel) {
        const factor = Math.max(1, Number(loteSel?.cantidadUnidadesMinimas || it.factorUnidad || 1));
        if (it.modo === 'empaque') return Math.max(0, Number(it.cantEmpaques || 0)) * factor;
        return Math.max(0, Number(it.cantUnidadesMinimas || 0));
    }

    function disponibilidadLote(it) {
        const loteSel = obtenerLoteSeleccionado(it);
        if (!loteSel) return { factor: 1, totalUnidades: 0 };
        const factor = Math.max(1, Number(loteSel.cantidadUnidadesMinimas || it.factorUnidad || 1));
        const totalUnidades = Number(loteSel.totalUnidadesMinimas ?? loteSel.cantidadTotalMinima ?? (Number(loteSel.cantidadEmpaques || 0) * factor));
        return { factor, totalUnidades, loteSel };
    }

    function clampItemStock(nuevo, itemsPrev) {
        const { factor, totalUnidades } = disponibilidadLote(nuevo);
        const usoOtros = itemsPrev
            .filter((p) => p.lineId !== nuevo.lineId && p.loteId === nuevo.loteId)
            .reduce((acc, p) => {
                const loteSel = obtenerLoteSeleccionado(p);
                return acc + unidadesSolicitadas(p, loteSel);
            }, 0);
        const disponible = Math.max(0, totalUnidades - usoOtros);
        const solicitadas = unidadesSolicitadas(nuevo, obtenerLoteSeleccionado(nuevo));
        if (solicitadas <= disponible) return nuevo;
        // Ajustar segun modo
        const ajustado = { ...nuevo };
        if (nuevo.modo === 'empaque') {
            ajustado.cantEmpaques = Math.floor(disponible / factor);
            ajustado.cantUnidadesMinimas = 0;
            triggerToast('error', `Stock insuficiente en el lote. Disponibles: ${Math.floor(disponible / factor)} empaques.`);
        } else {
            ajustado.cantUnidadesMinimas = disponible;
            triggerToast('error', `Stock insuficiente en el lote. Disponibles: ${disponible} unidades.`);
        }
        return ajustado;
    }

    async function addProducto(prod) {
        setError(''); setOk(null);
        try {
            const lots = await getLotes({ productoId: prod.ProductoID, estado: 'activos' });
            const filtrados = lots
                .filter(l => (l.diasRestantes == null || l.diasRestantes >= 0))
                .filter(l => (l.cantidadEmpaques > 0 || l.cantidadUnidadesMinimas > 0 || l.cantidadTotalMinima > 0 || l.totalUnidadesMinimas > 0));
            const disponibles = filtrados
                .sort((a, b) => {
                    const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER;
                    const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Number.MAX_SAFE_INTEGER;
                    if (fa !== fb) return fa - fb;
                    return (a.loteId || 0) - (b.loteId || 0);
                });
            if (!disponibles.length) {
                setError('No hay lotes activos/no vencidos con stock disponible.');
                return;
            }
            const factor = Math.max(1, Number(disponibles[0]?.cantidadUnidadesMinimas || prod.CantidadUnidadesMinimas || 1));
            const nuevo = {
                lineId: (++lineIdRef.current),
                productoId: prod.ProductoID,
                nombre: prod.Nombre,
                presentacion: prod.Presentacion,
                factorUnidad: factor,
                impuesto: Number(prod.Impuesto || 0),
                lotes: disponibles.map(l => ({
                    loteId: l.loteId,
                    numeroLote: l.numeroLote,
                    fechaVencimiento: l.fechaVencimiento,
                    cantidadEmpaques: l.cantidadEmpaques,
                    cantidadUnidadesMinimas: l.cantidadUnidadesMinimas,
                    cantidadTotalMinima: l.cantidadTotalMinima,
                    totalUnidadesMinimas: l.totalUnidadesMinimas,
                    precioUnitarioVenta: l.precioVenta,
                    precioVenta: l.precioVenta,
                    impuesto: Number(prod.Impuesto || 0),
                    porcentajeImpuesto: Number(prod.Impuesto || 0),
                    descuento: l.descuento,
                    porcentajeDescuentoEmpaque: l.descuento,
                    marcaId: l.marcaId || null,
                    marcaNombre: l.marcaNombre || null,
                })),
                loteId: disponibles[0]?.loteId || null,
                marcaId: disponibles[0]?.marcaId || null,
                modo: 'empaque',
                metodoPago: formaPago || 'Efectivo',
                cantEmpaques: 0,
                cantUnidadesMinimas: 0,
            };
            setItems(prev => [...prev, nuevo]);
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

    function validarStockGlobal() {
        const consumoPorLote = new Map();
        const disponibilidadPorLote = new Map();
        for (const it of items) {
            const { factor, totalUnidades } = disponibilidadLote(it);
            const key = String(it.loteId || 'none');
            disponibilidadPorLote.set(key, { totalUnidades, factor });
            const usoActual = consumoPorLote.get(key) || 0;
            consumoPorLote.set(key, usoActual + unidadesSolicitadas(it, obtenerLoteSeleccionado(it)));
        }
        for (const [key, consumo] of consumoPorLote.entries()) {
            const { totalUnidades = 0, factor = 1 } = disponibilidadPorLote.get(key) || {};
            if (consumo > totalUnidades) {
                const dispEmp = Math.floor(totalUnidades / factor);
                const restantes = Math.max(0, totalUnidades);
                triggerToast('error', `Stock insuficiente en el lote seleccionado. Disponibles: ${dispEmp} empaques / ${restantes} unidades.`);
                return false;
            }
        }
        return true;
    }

    function validarCantidadesPositivas() {
        for (const it of items) {
            const loteSel = obtenerLoteSeleccionado(it);
            const unidades = unidadesSolicitadas(it, loteSel);
            if (!Number.isFinite(unidades) || unidades <= 0) {
                triggerToast('error', 'Ingresa una cantidad mayor a 0 para cada producto.');
                return false;
            }
        }
        return true;
    }

    function openConfirm() {
        if (items.length === 0) { const msg = 'No hay items en el carrito.'; setError(msg); triggerToast('error', msg); return; }
        if (!validarCantidadesPositivas()) return;
        if (!validarStockGlobal()) return;
        const validarMontoRecibido = formaPago === 'Efectivo' && items.length > 0;
        const montoRecibidoNumber = Number(montoRecibido);
        const montoRecibidoIngresado = montoRecibido !== '';
        const montoRecibidoValido = !validarMontoRecibido || (
            montoRecibidoIngresado &&
            Number.isFinite(montoRecibidoNumber) &&
            montoRecibidoNumber >= 0 &&
            Math.round((montoRecibidoNumber - calcularTotales.total) * 100) >= 0
        );
        if (validarMontoRecibido && !montoRecibidoValido) { const msg = 'El monto recibido en efectivo debe ser un numero valido y mayor o igual al total.'; setError(msg); triggerToast('error', msg); return; }
        if (estado.toLowerCase() === 'credito' && !clienteSel) { const msg = 'Para credito debe seleccionar cliente.'; setError(msg); triggerToast('error', msg); return; }
        setShowConfirm(true);
    }

    async function onFinalizar() {
        if (items.length === 0) { const msg = 'No hay items en el carrito.'; setError(msg); triggerToast('error', msg); return; }
        if (!validarCantidadesPositivas()) return;
        if (!validarStockGlobal()) return;
        const validarMontoRecibido = formaPago === 'Efectivo' && items.length > 0;
        const montoRecibidoNumber = Number(montoRecibido);
        const montoRecibidoIngresado = montoRecibido !== '';
        const montoRecibidoValido = !validarMontoRecibido || (
            montoRecibidoIngresado &&
            Number.isFinite(montoRecibidoNumber) &&
            montoRecibidoNumber >= 0 &&
            Math.round((montoRecibidoNumber - calcularTotales.total) * 100) >= 0
        );
        if (validarMontoRecibido && !montoRecibidoValido) { const msg = 'El monto recibido en efectivo debe ser un numero valido y mayor o igual al total.'; setError(msg); triggerToast('error', msg); return; }
        if (estado.toLowerCase() === 'credito' && !clienteSel) { const msg = 'Para credito debe seleccionar cliente.'; setError(msg); triggerToast('error', msg); return; }
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
            triggerToast('success', `Venta generada correctamente${resp?.ventaId ? ` (#${resp.ventaId})` : ''}`);
            try {
                if (resp?.ventaId) {
                    const { blob, filename } = await getVentaPdf(resp.ventaId);
                    const url = URL.createObjectURL(blob);
                    const win = window.open(url, '_blank');
                    if (!win) {
                        const a = document.createElement('a');
                        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
                    }
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                }
            } catch { }
            setItems([]);
            setDescuentoValor(0); setDescuentoTipo('%'); setObservaciones('');
        } catch (err) {
            const msg = err.message || 'Error al finalizar la venta';
            triggerToast('error', msg);
        } finally { setSaving(false); }
    }

    // --- Devoluciones integradas en PuntoVenta ---
    async function devBuscar() {
        const id = Number(devFacturaNo);
        const tieneId = Number.isFinite(id) && id > 0;
        const tieneRango = Boolean(devFrom || devTo);

        if (!tieneId && !tieneRango) {
            const msg = 'Ingrese un numero de factura valido o un rango de fechas';
            setDevError(msg);
            triggerToast('error', msg);
            return;
        }
        setDevError(''); setDevLoading(true);
        try {
            if (tieneId) {
                const data = await getVenta(id);
                const cab = data?.cabecera;
                setDevVentas(cab ? [cab] : []);
                if (!cab) {
                    const msg = 'Factura no encontrada';
                    setDevError(msg);
                    triggerToast('error', msg);
                }
                try {
                    const raw = localStorage.getItem(`DEV_FLAG_VENTA_${id}`);
                    if (raw) {
                        const o = JSON.parse(raw);
                        const fecha = o?.ts ? new Date(o.ts).toLocaleString() : null;
                        const nota = fecha ? `Se registro una devolucion el ${fecha}.` : 'Se registro una devolucion para esta factura.';
                        setDevNotaCredito(nota);
                        triggerToast('success', nota);
                    } else {
                        setDevNotaCredito(null);
                    }
                } catch {
                    setDevNotaCredito(null);
                }
            } else {
                const params = {};
                if (devFrom) params.from = devFrom;
                if (devTo) params.to = devTo;
                const data = await getVentas(params);
                const lista = Array.isArray(data) ? data : [];
                setDevVentas(lista);
                if (!lista.length) {
                    const msg = 'No se encontraron facturas en el rango';
                    setDevError(msg);
                    triggerToast('error', msg);
                }
                setDevNotaCredito(null);
            }
        } catch (e) {
            setDevVentas([]);
            const msg = e?.message || 'No se pudo obtener la factura';
            setDevError(msg);
            triggerToast('error', msg);
            setDevNotaCredito(null);
        } finally { setDevLoading(false); }
    }

    // --- Reimprimir / regenerar factura ---
    async function reimpBuscar() {
        const id = Number(reimpNo);
        if (!Number.isFinite(id) || id <= 0) {
            const msg = 'Factura no encontrada';
            setReimpError(msg);
            setReimpData(null);
            triggerToast('error', msg);
            return;
        }
        setReimpError(''); setReimpLoading(true);
        try {
            const data = await getVenta(id);
            let cab = data?.cabecera || null;
            if (cab?.ClienteID) {
                try {
                    const cli = await getClienteById(cab.ClienteID);
                    const nombre = `${cli?.Nombres || ''} ${cli?.Apellidos || ''}`.trim();
                    cab = { ...cab, ClienteNombre: nombre || cab.ClienteID };
                } catch {
                    cab = { ...cab, ClienteNombre: cab.ClienteID };
                }
            }
            setReimpData(cab ? { id, cab } : null);
            if (!cab) {
                const msg = 'Factura no encontrada';
                setReimpError(msg);
                triggerToast('error', msg);
            }
        } catch (e) {
            setReimpData(null);
            const msg = e?.message || 'No se pudo obtener la factura';
            setReimpError(msg);
            triggerToast('error', msg);
        } finally {
            setReimpLoading(false);
        }
    }

    async function reimpVerPdf() {
        const id = Number(reimpNo);
        if (!Number.isFinite(id) || id <= 0) return;
        try {
            const { blob, filename } = await getVentaPdf(id);
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win) {
                const a = document.createElement('a');
                a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (e) {
            setReimpError(e?.message || 'No se pudo obtener el PDF');
        }
    }

    async function histBuscar(fechaParam) {
        const fallback = new Date().toISOString().slice(0, 10);
        const fecha = fechaParam || histFecha || fallback;
        if (Number.isNaN(new Date(fecha).getTime())) {
            setHistError('Fecha invalida');
            return;
        }
        setHistError('');
        setHistLoading(true);
        try {
            const data = await getHistorialDia(fecha);
            setHistData(data || null);
        } catch (e) {
            setHistData(null);
            setHistError(e?.message || 'No se pudo obtener el historial');
        } finally {
            setHistLoading(false);
        }
    }

    async function devAbrirDetalle(v) {
        setDevDetalle({ open: true, ventaId: v.VentaID, cab: null, items: [], err: '', msg: '' });
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
            setDevDetalle({ open: true, ventaId: v.VentaID, cab: data.cabecera, items, err: '', msg: '' });
        } catch (e) {
            const msg = e.message || 'No se pudo cargar el detalle';
            setDevDetalle((prev) => ({ ...prev, err: msg }));
            triggerToast('error', msg);
        }
    }

    async function devAbrirResumen(v) {
        setDevResumen({ open: true, ventaId: v.VentaID, cab: null, items: [], err: '' });
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
            setDevResumen({ open: true, ventaId: v.VentaID, cab, items, err: '' });
        } catch (e) {
            const msg = e.message || 'No se pudo cargar el resumen';
            setDevResumen((prev) => ({ ...prev, err: msg }));
            triggerToast('error', msg);
        }
    }

    async function devConfirmarDevolucion() {
        try {
            const devolver = devDetalle.items
                .filter(i => Number(i.devolver) > 0)
                .map(i => ({ productoId: i.productoId, loteId: i.loteId, unidades: Number(i.devolver) }));
            if (devolver.length === 0) {
                const msg = 'No hay cantidades a devolver';
                setDevDetalle((p) => ({ ...p, err: msg }));
                triggerToast('error', msg);
                return;
            }
            await aplicarDevolucion(devDetalle.ventaId, { items: devolver });
            try {
                const data = await getVenta(devDetalle.ventaId);
                const restantes = (data.detalle || []).map(d => {
                    const vendidas = Number(d.CantidadUnidadesMinimasVendidas || 0) + Number(d.CantidadEmpaquesVendidos || 0);
                    const dev = Number((devDetalle.items.find(x => x.productoId===d.ProductoID && x.loteId===d.LoteID)?.devolver) || 0);
                    const rem = Math.max(0, vendidas - dev);
                    return rem > 0 ? { productoId: d.ProductoID, loteId: d.LoteID, unidades: rem, nombre: d.NombreProducto, presentacion: d.Presentacion } : null;
                }).filter(Boolean);
                sessionStorage.setItem('POS_PRELOAD_RETURN', JSON.stringify({ clienteId: data?.cabecera?.ClienteID || null, items: restantes }));
                try { localStorage.setItem(`DEV_FLAG_VENTA_${devDetalle.ventaId}`, JSON.stringify({ ts: Date.now() })); } catch {}
            } catch { /* si falla, igual continua */ }
            setDevDetalle((p) => ({ ...p, msg: 'Devolucion aplicada', err: '' }));
            triggerToast('success', 'Devolucion aplicada');
            setTimeout(() => setActiveTab('venta'), 300);
        } catch (e) {
            const msg = e.message || 'Error al aplicar devolucion';
            setDevDetalle((p) => ({ ...p, err: msg }));
            triggerToast('error', msg);
        }
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
    const cambio = requiereMontoRecibido && montoRecibidoIngresado && Number.isFinite(montoRecibidoNumber)
        ? number(Math.max(0, montoRecibidoNumber - total), 2)
        : null;
    const mostrarErrorMonto = validarMontoRecibido && montoRecibidoIngresado && !montoRecibidoValido;
    const finalizarDisabled = saving || items.length === 0 || (validarMontoRecibido && !montoRecibidoValido);

    const dataTableStyles = useMemo(() => ({
        headCells: {
            style: {
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '10px',
                paddingRight: '10px',
            },
        },
        cells: {
            style: {
                paddingTop: '6px',
                paddingBottom: '6px',
                paddingLeft: '10px',
                paddingRight: '10px',
            },
        },
    }), []);

    const columnasDevoluciones = useMemo(() => ([
        { name: 'No. Factura', selector: v => v.VentaID, sortable: true, minWidth: '80px' },
        { name: 'Fecha', selector: v => v.FechaVenta, sortable: true, minWidth: '140px', cell: v => new Date(v.FechaVenta).toLocaleString() },
        { name: 'Cliente', selector: v => v.ClienteID ?? '-', wrap: true, minWidth: '120px' },
        { name: 'Estado', selector: v => v.Estado || '-', sortable: true, minWidth: '100px' },
        { name: 'Forma pago', selector: v => v.FormaPago || '-', sortable: true, minWidth: '120px' },
        { name: 'Total', selector: v => Number(v.Total || 0), right: true, minWidth: '120px', cell: v => Number(v.Total || 0).toFixed(2) },
        {
            name: 'Acciones',
            minWidth: '300px',
            cell: v => (
                <div className="d-flex justify-content-end gap-2">
                    <CustomButton className="btn-sm btn-outline-secondary" onClick={() => devAbrirResumen(v)}>
                        <i className="bi bi-eye me-1" aria-hidden="true" />
                        Ver resumen
                    </CustomButton>
                    <CustomButton
                        className="btn-sm btn-outline-primary"
                        disabled={!canProcessDevol}
                        title={canProcessDevol ? '' : 'No autorizado'}
                        onClick={() => devAbrirDetalle(v)}
                    >
                        <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                        Procesar
                    </CustomButton>
                </div>
            )
        }
    ]), [canProcessDevol]);

    const columnasHistorialDia = useMemo(() => ([
        { name: 'No. factura', selector: v => v.numeroFactura || '-', sortable: true, width: '100px', grow: 0 },
        { name: 'Hora', selector: v => v.hora || '-',wrap: true, sortable: true, width: '100px', grow: 0 },
        { name: 'Cliente', selector: v => v.cliente || '-', wrap: true,  width: '100px', grow: 0 },
        { name: 'Total', selector: v => v.total || 0, right: true, wrap: true,   width: '100px', grow: 0, cell: v => formatMoney(v.total || 0, currencySymbol) },
        { name: 'F. de pago', selector: v => v.metodoPago || '-',   width: '80px', grow: 0},
        { name: 'Usuario', selector: v => v.usuario || '-',  wrap: true,  width: '80px', grow: 0 },
        { name: 'Estado', selector: v => v.estado || '-',  wrap: true,  width: '80px', grow: 0 },
    ]), [currencySymbol]);

    const columnasResumenFactura = useMemo(() => ([
        {
            name: 'Producto',
            grow: 2,
            cell: (it) => (
                <div>
                    <div className="fw-semibold">{it.producto}</div>
                    <div className="text-muted small">{it.presentacion}</div>
                </div>
            )
        },
        { name: 'Lote', selector: it => it.numeroLote || '-', grow: 1 },
        { name: 'Modo', selector: it => it.cantEmp > 0 ? `Empaque x${it.cantEmp}` : 'Detalle', grow: 1 },
        { name: 'Unid.', selector: it => it.cantUni || 0, right: true, width: '90px' },
        { name: 'P. Unit.', selector: it => Number(it.precio || 0), right: true, width: '110px', cell: it => Number(it.precio || 0).toFixed(2) },
    ]), []);

    const resumenTableStyles = useMemo(() => ({
        headCells: { style: { paddingTop: '10px', paddingBottom: '10px', fontWeight: 700 } },
        cells: { style: { paddingTop: '8px', paddingBottom: '8px' } },
    }), []);

    return (
        <div className="container py-3">
            <div className="d-flex justify-content-end mb-3">
                <TabBar
                    tabs={tabOptions}
                    active={activeTab}
                    onSelect={handleTabSelect}
                    className="ms-auto"
                    ariaLabel="Secciones de facturacion"
                />
            </div>

            {activeTab === 'venta' && (
                <>
                    <div className="card mb-3 venta-card">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3 mb-3 justify-content-end">
                                <input
                                    style={{ width: '50%' }}
                                    ref={inputBusquedaRef}
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    onKeyDown={onKeyDownBusqueda}
                                    className="form-control"
                                    placeholder="Buscar productos..."
                                />
                                <button className="scanner-btn" type="button" title="Escaner UPC">
                                    <i className="bi bi-upc-scan"></i>
                                </button>
                            </div>
                            {loadingSug && <div className="small text-muted mb-2">Buscando...</div>}
                            {!!sugerencias.length && (
                                <div className="list-group mb-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
                                    {sugerencias.map((p, idx) => (
                                        <button
                                            key={p.ProductoID}
                                            className={`list-group-item list-group-item-action d-flex justify-content-between ${idx === sugIndex ? 'active' : ''} ${p._sinStock ? 'opacity-50' : ''}`}
                                            onMouseEnter={() => setSugIndex(idx)}
                                            onClick={() => addProducto(p)}
                                            disabled={p._sinStock}
                                        >
                                            <span>{p.Nombre}{p.Presentacion ? ` - ${p.Presentacion}` : ''}</span>
                                            {p._sinStock ? (
                                                <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
                                                    <i className="bi bi-slash-circle"></i> Sin stock
                                                </span>
                                            ) : (
                                                <i className="bi bi-plus-circle"></i>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                    <div className="table-responsive pos-table" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table className="table table-sm align-middle">
                                    <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th>Producto</th>
                                            <th style={{ width: 170 }}>Marca</th>
                                            <th style={{ width: 240 }}>Lote</th>
                                            <th style={{ width: 150 }}>Cantidad</th>
                                            <th style={{ width: 140 }}>Stock</th>
                                            <th className="text-end" style={{ width: 110 }}>Precio</th>
                                            <th className="text-end" style={{ width: 90 }}>Itbis</th>
                                            <th className="text-end" style={{ width: 110 }}>Total</th>
                                            <th style={{ width: 60 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => (
                                            <LineaItem
                                                key={it.lineId || `${it.productoId}-${it.loteId}-${idx}`}
                                                item={it}
                                                currencySymbol={currencySymbol}
                                                onChange={(nuevo) => setItems(prev => prev.map(p => (p.lineId === it.lineId ? clampItemStock(nuevo, prev) : p)))}
                                                onRemove={() => setItems(prev => prev.filter(p => p.lineId !== it.lineId))}
                                            />
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="text-center py-3">
                                                    <span className="empty-chip">
                                                        <i className="bi bi-cart-plus me-2"></i>
                                                        No hay productos en el carrito
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="row g-3 align-items-stretch">
                        <div className="col-md-6 d-flex">
                    <div className="card cliente-card w-100 h-100"><div className="card-body h-100 d-flex flex-column">
                                <div className="row g-2">
                            <div className="col-12">
                                <label className="form-label">Cliente</label>
                                <div className={`cliente-input-container ${clienteSel ? 'cliente-input-container--selected' : ''}`}>
                                    {clienteSel && (
                                        <div className="cliente-chip">
                                            <div className="cliente-chip-content">
                                                <span className="cliente-chip-name">{clienteSel.Nombres} {clienteSel.Apellidos}</span>
                                                <span className="cliente-chip-doc text-muted small">
                                                    {(clienteSel.TipoDocumentoNombre || clienteSel.TipoDocumento || clienteSel.TipoDocumentoID || 'Doc')}: {clienteSel.Documento}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="cliente-chip-remove"
                                                aria-label="Quitar cliente"
                                                onClick={() => { setClienteSel(null); setClienteTerm(''); }}
                                            >
                                                <i className="bi-x-lg"></i>
                                            </button>
                                        </div>
                                    )}
                                    {!clienteSel && (
                                        <input
                                            className="cliente-chip-input"
                                            placeholder="Buscar cliente por nombre o documento..."
                                            value={clienteTerm}
                                            onChange={(e) => {
                                                setClienteTerm(e.target.value);
                                                if (!e.target.value) setClienteSel(null);
                                            }}
                                        />
                                    )}
                                </div>
                                {!!clienteSug.length && (
                                    <div
                                        className="list-group mt-2 cliente-sug-list"
                                        style={{ maxHeight: 100, overflowY: 'auto' }}
                                    >
                                        {clienteSug.map((c) => {
                                            const tipoDoc = c.TipoDocumentoNombre || c.TipoDocumento || c.TipoDocumentoID || 'Doc';
                                            return (
                                                <button
                                                    key={c.ClienteID}
                                                    className="list-group-item list-group-item-action"
                                                    onClick={() => {
                                                        setClienteSel(c);
                                                        setClienteTerm('');
                                                        setClienteSug([]);
                                                    }}
                                                >
                                                    <div className="fw-semibold">{c.Nombres} {c.Apellidos}</div>
                                                    <div className="text-muted small">
                                                        {tipoDoc}: {c.Documento}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {!clienteSel && !clienteSug.length && (
                                    <div className="text-muted small mt-1">Ningun cliente seleccionado.</div>
                                )}
                            </div>
                                    <div className="col-4">
                                        <label className="form-label">Forma de pago</label>
                                        <select className="form-select" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                                            <option>Efectivo</option>
                                            <option>Tarjeta</option>
                                            <option>Credito</option>
                                        </select>
                                    </div>
                                    {formaPago === 'Efectivo' && (
                                        <div className="col-4">
                                            <label className="form-label">Monto recibido</label>
                                            <input
                                                type="number"
                                                min={Math.max(0, total)}
                                                step="0.01"
                                                placeholder={`Monto >= ${formatMoney(total, currencySymbol)}`}
                                                className={`form-control ${mostrarErrorMonto ? 'is-invalid' : ''}`}
                                                value={montoRecibido}
                                                onChange={(e) => setMontoRecibido(e.target.value)}
                                            />
                                            {validarMontoRecibido && !mostrarErrorMonto && (
                                                <div className="form-text">Debe cubrir al menos el total ({formatMoney(total, currencySymbol)}).</div>
                                            )}
                                            {mostrarErrorMonto && (
                                                <div className="invalid-feedback">El monto recibido debe ser mayor o igual al total ({formatMoney(total, currencySymbol)}).</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="col-4">
                                        <label className="form-label">Estado</label>
                                        {estadoOpciones.length === 1 ? (
                                            <div className="form-control bg-light">{estadoOpciones[0]}</div>
                                        ) : (
                                            <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                                                {estadoOpciones.map((opt) => (
                                                    <option key={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div></div>
                        </div>
                        <div className="col-md-6 d-flex">
                    <div className="card h-100 w-100 totales-card"><div className="card-body d-flex flex-column">
                                <div className="d-flex justify-content-between totales-row-label"><div className="totales-label">Subtotal</div><div className="fw-semibold">{formatMoney(subtotal, currencySymbol)}</div></div>
                                <div className="d-flex justify-content-between totales-row-label"><div className="totales-label">Impuestos</div><div className="fw-semibold">{formatMoney(impuestoTotal, currencySymbol)}</div></div>
                                <div className="totales-row-label my-2 d-flex align-items-center justify-content-between flex-wrap">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <div className="totales-label mb-0" style={{ minWidth: 90 }}>Descuento</div>
                                        <div
                                            className="text-muted chip-desc-switch"
                                        >
                                            <div className="form-switch">
                                                <input className="form-check-input" type="checkbox" role="switch" id="tipoDescSwitch" checked={descuentoTipo === '%'} onChange={(e) => setDescuentoTipo(e.target.checked ? '%' : '$')} />
                                                <label className="form-check-label" htmlFor="tipoDescSwitch">
                                                    {descuentoTipo === '%' ? '%' : currencySymbol}
                                                </label>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            style={{ width: 80 }}
                                            min={0}
                                            value={descuentoValor}
                                            onChange={(e) => setDescuentoValor(e.target.value)}
                                        />
                                    </div>
                                    <div className="fw-semibold">- {formatMoney(descuento ?? 0, currencySymbol)}</div>
                                </div>
                                <div className="d-flex justify-content-between fs-5 mt-2 totales-row-label"><div className="totales-label">Total</div><div className="fw-bold">{formatMoney(total, currencySymbol)}</div></div>
                                <div className="mt-3">
                                    <label className="form-label totales-label">Observaciones</label>
                                    <textarea className="form-control observaciones-textarea" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                                </div>
                                {!!error && <div className="alert alert-danger mt-2 mb-0 py-2">{error}</div>}
                                <div className="mt-auto d-flex gap-2 pt-2">
                                    <ActionButton
                                        variant="primary"
                                        icon="bi bi-check2-circle"
                                        disabled={finalizarDisabled}
                                        onClick={openConfirm}
                                        loading={saving}
                                        text="Finalizar venta"
                                    />
                                    <ActionButton
                                        variant="outline-danger"
                                        icon="bi bi-trash3"
                                        onClick={() => setItems([])}
                                        text="Limpiar"
                                    />
                                </div>
                            </div></div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'Devoluciones' && (
                <div className="container py-2 Devoluciones-wrapper">
                    <div className="card mb-3 Devoluciones-filtros">
                        <div className="card-body">
                            <div className="row g-2 align-items-end">
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Desde</label>
                                    <input type="date" className="form-control" value={devFrom} onChange={(e)=>setDevFrom(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">Hasta</label>
                                    <input type="date" className="form-control" value={devTo} onChange={(e)=>setDevTo(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-3">
                                    <label className="form-label">No. factura</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        placeholder="Ej: 1005"
                                        value={devFacturaNo}
                                        onChange={(e)=>setDevFacturaNo(e.target.value)}
                                        onKeyDown={(e)=>{ if(e.key==='Enter' && !devLoading && (Number(devFacturaNo)>0 || devFrom || devTo)) devBuscar(); }}
                                    />
                                </div>
                                <div className="col-12 col-md-2 d-grid d-md-flex">
                                    <CustomButton
                                        className="btn-primary"
                                        onClick={devBuscar}
                                        disabled={devLoading || (!(Number(devFacturaNo) > 0) && !devFrom && !devTo)}
                                    >
                                        <i className="bi bi-search me-2" aria-hidden="true" />
                                        {devLoading ? 'Buscando...' : 'Buscar'}
                                    </CustomButton>
                                </div>
                            </div>

                            <div className="mt-3 Devoluciones-resultados">
                                <DataTable
                                    columns={columnasDevoluciones}
                                    data={devVentas}
                                    dense
                                    highlightOnHover
                                    fixedHeader
                                    fixedHeaderScrollHeight="360px"
                                    customStyles={dataTableStyles}
                                    noDataComponent={<div className="text-muted py-3">Sin resultados</div>}
                                />
                            </div>
                        </div>
                    </div>

                    {devDetalle.open && (
                        <div className="inventory-modal-backdrop" onClick={()=>setDevDetalle({ open:false, ventaId:null, cab:null, items:[], err:'', msg:'' })}>
                            <div
                                className="inventory-modal resumen-modal"
                                style={{ width: '72%', height: 'auto', maxHeight: '80vh' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="inventory-modal-header">
                                    <div className="inventory-modal-title-badge">
                                        <i className="bi bi-arrow-counterclockwise"></i>
                                        <span>Devolucion Venta #{devDetalle.ventaId}</span>
                                    </div>
                                    <button className="btn-close" onClick={()=>setDevDetalle({ open:false, ventaId:null, cab:null, items:[], err:'', msg:'' })}>
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                                <div className="inventory-modal-body">
                                    {devDetalle.err && <div className="alert alert-danger">{devDetalle.err}</div>}
                                    <DataTable
                                        columns={[
                                            {
                                                name: 'Producto',
                                                grow: 2,
                                                cell: (it) => (
                                                    <div>
                                                        <div className="fw-semibold">{it.nombre}</div>
                                                        <div className="text-muted small">{it.presentacion}</div>
                                                    </div>
                                                )
                                            },
                                            { name: 'Lote', selector: it => it.numeroLote || it.loteId || '-', grow: 1 },
                                            { name: 'Vend.', selector: it => Number(it.cantidadVendida || 0), right: true, width: '90px' },
                                            {
                                                name: 'Devolver',
                                                width: '140px',
                                                right: true,
                                                cell: (it, idx) => (
                                                    <input
                                                        type="number"
                                                        className="form-control form-control-sm text-end"
                                                        min={0}
                                                        max={Number(it.cantidadVendida || 0)}
                                                        value={it.devolver}
                                                        onChange={(e) => {
                                                            const v = Math.max(0, Math.min(Number(e.target.value || 0), Number(it.cantidadVendida || 0)));
                                                            setDevDetalle((prev) => ({
                                                                ...prev,
                                                                items: prev.items.map((x, i) => (i === idx ? { ...x, devolver: v } : x)),
                                                            }));
                                                        }}
                                                    />
                                                )
                                            }
                                        ]}
                                        data={devDetalle.items || []}
                                        dense
                                        highlightOnHover
                                        customStyles={resumenTableStyles}
                                        noDataComponent={<div className="text-muted py-3">Sin detalle</div>}
                                    />
                                </div>
                                <div className="inventory-modal-footer">
                                    <ActionButton
                                        variant="outline-danger"
                                        icon="bi bi-x-circle"
                                        text="Cancelar"
                                        type="button"
                                        onClick={()=>setDevDetalle({ open:false, ventaId:null, cab:null, items:[], err:'', msg:'' })}
                                    />
                                    <CustomButton
                                        className="btn-primary"
                                        disabled={!canProcessDevol}
                                        onClick={devConfirmarDevolucion}
                                    >
                                        <i className="bi bi-check-circle me-1" aria-hidden="true" />
                                        Aplicar Devolucion
                                    </CustomButton>
                                </div>
                            </div>
                        </div>
                    )}

                    {devResumen.open && (
                        <div className="inventory-modal-backdrop" onClick={()=>setDevResumen({ open:false, ventaId:null, cab:null, items:[], err:'' })}>
                            <div
                                className="inventory-modal resumen-modal"
                                style={{ width: '72%', height: 'auto', maxHeight: '80vh' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="inventory-modal-header">
                                    <div className="inventory-modal-title-badge">
                                        <i className="bi bi-receipt"></i>
                                        <span>Resumen factura #{devResumen.ventaId}</span>
                                    </div>
                                    <button className="btn-close" onClick={()=>setDevResumen({ open:false, ventaId:null, cab:null, items:[], err:'' })}>
                                        <i className="bi bi-x-lg"></i>
                                    </button>
                                </div>
                                <div className="inventory-modal-body">
                                    {devResumen.err && <div className="alert alert-danger">{devResumen.err}</div>}
                                    {(() => { try { return !!localStorage.getItem(`DEV_FLAG_VENTA_${devResumen.ventaId}`); } catch { return false; } })() && (
                                        <div className="alert alert-info py-2">Esta factura tiene una devolucion registrada.</div>
                                    )}
                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-md-6">
                                            <div className="fw-semibold">Fecha:</div>
                                            <div>{devResumen.cab ? new Date(devResumen.cab.FechaVenta).toLocaleString() : '-'}</div>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <div className="fw-semibold">Cliente:</div>
                                            <div>{devResumen.cab?.ClienteNombre || (devResumen.cab?.ClienteID ?? '-')}</div>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <div className="fw-semibold">Forma de pago:</div>
                                            <div>{devResumen.cab?.FormaPago ?? '-'}</div>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <div className="fw-semibold">Estado:</div>
                                            <div>{devResumen.cab?.Estado ?? '-'}</div>
                                        </div>
                                        {!!devResumen.cab?.Observaciones && (
                                            <div className="col-12">
                                                <div className="fw-semibold">Observaciones:</div>
                                                <div>{devResumen.cab.Observaciones}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="table-responsive mb-3">
                                        <DataTable
                                            columns={columnasResumenFactura}
                                            data={devResumen.items || []}
                                            dense
                                            highlightOnHover
                                            customStyles={resumenTableStyles}
                                            noDataComponent={<div className="text-muted py-3">Sin detalle</div>}
                                        />
                                    </div>

                                    <div className="d-flex justify-content-end">
                                        <div style={{ minWidth: 260 }}>
                                            <div className="d-flex justify-content-between"><div>Subtotal</div><div>{Number(devResumen.cab?.Subtotal||0).toFixed(2)}</div></div>
                                            <div className="d-flex justify-content-between"><div>Descuento</div><div>{Number(devResumen.cab?.DescuentoTotal||0).toFixed(2)}</div></div>
                                            <div className="d-flex justify-content-between"><div>Impuestos</div><div>{Number(devResumen.cab?.ImpuestoTotal||0).toFixed(2)}</div></div>
                                            <div className="d-flex justify-content-between fw-bold fs-6"><div>Total</div><div>{Number(devResumen.cab?.Total||0).toFixed(2)}</div></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'otras' && (
                <div className="otras-opciones-container">
                        <div className="row g-3">
                            <div className="col-12 col-lg-6">
                                <div className="card">
                                    <div className="card-body">
                                        <h6 className="mb-2">Reimprimir / Regenerar factura</h6>
                                        <div className="mb-2">
                                            <label className="form-label">No. factura</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                placeholder="Ej: 1005"
                                                value={reimpNo}
                                                onChange={(e)=>setReimpNo(e.target.value)}
                                                onKeyDown={(e)=>{ if (e.key==='Enter') reimpBuscar(); }}
                                            />
                                        </div>
                                        <div className="d-flex gap-2 mb-3">
                                            <CustomButton
                                                className="btn-primary"
                                                onClick={reimpBuscar}
                                                disabled={reimpLoading}
                                            >
                                                <i className="bi bi-search me-1" aria-hidden="true" />
                                                {reimpLoading ? 'Buscando...' : 'Buscar'}
                                            </CustomButton>
                                            <CustomButton
                                                className="btn-outline-secondary"
                                                onClick={reimpVerPdf}
                                                disabled={!reimpNo || reimpLoading}
                                            >
                                                <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
                                                Ver PDF
                                            </CustomButton>
                                            <CustomButton
                                                className="btn-outline-primary"
                                                onClick={reimpVerPdf}
                                                disabled={!reimpNo || reimpLoading}
                                            >
                                                <i className="bi bi-printer me-1" aria-hidden="true" />
                                                Reimprimir
                                            </CustomButton>
                                        </div>
                                        {reimpLoading && <div className="text-muted">Cargando...</div>}
                                        {reimpData && (
                                            <div className="alert alert-info reimpresion-alert">
                                                <div><strong>No. Factura:</strong> {reimpNo}</div>
                                                <div><strong>Fecha:</strong> {reimpData.cab?.FechaVenta ? new Date(reimpData.cab.FechaVenta).toLocaleString() : '-'}</div>
                                                <div><strong>Cliente:</strong> {reimpData.cab?.ClienteNombre || reimpData.cab?.ClienteID || '-'}</div>
                                                <div><strong>Total:</strong> {formatMoney(Number(reimpData.cab?.Total || 0), currencySymbol)}</div>
                                                <div><strong>Estado:</strong> {reimpData.cab?.Estado || '-'}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 col-lg-6">
                                <div className="card">
                                    <div className="card-body">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <h6 className="mb-0">Historial del dia</h6>

                                        </div>
                                        <div className="row g-2 align-items-end mb-3">
                                            <div className="col-12 col-sm-7">
                                                <label className="form-label mb-1">Fecha</label>
                                                <input
                                                    type="date"
                                                    className="form-control"
                                                    value={histFecha}
                                                    onChange={(e)=>setHistFecha(e.target.value)}
                                                    onKeyDown={(e)=>{ if (e.key==='Enter') histBuscar(); }}
                                                />
                                            </div>
                                            <div className="col-12 col-sm-5 d-flex gap-2">
                                            <CustomButton
                                                className="btn-primary"
                                                onClick={()=>histBuscar()}
                                                disabled={histLoading}
                                            >
                                                <i className="bi bi-search me-1" aria-hidden="true" />
                                                {histLoading ? 'Cargando...' : 'Buscar'}
                                                </CustomButton>
                                                <CustomButton
                                                    className="btn-outline-secondary"
                                                    onClick={() => { const hoy = new Date().toISOString().slice(0, 10); setHistFecha(hoy); histBuscar(hoy); }}
                                                    disabled={histLoading}
                                                >
                                                    <i className="bi bi-calendar-day me-1" aria-hidden="true" />
                                                    Hoy
                                                </CustomButton>
                                            </div>
                                        </div>
                                        {histError && <div className="alert alert-danger py-2">{histError}</div>}
                                        {histLoading && <div className="text-muted">Cargando...</div>}
                                        {!histLoading && !histError && histData && (
                                            <>
                                                <div className="row g-3 mb-3">
                                                    <div className="col-12 col-sm-4">
                                                        <div className="info-label">Total vendido</div>
                                                        <div className="chip-count w-100 text-center">{formatMoney(histData.totalVentas || 0, currencySymbol)}</div>
                                                    </div>
                                                    <div className="col-12 col-sm-4">
                                                        <div className="info-label">Cantidad de ventas</div>
                                                        <div className="chip-count w-100 text-center">{histData.cantidadVentas || 0}</div>
                                                    </div>
                                                <div className="col-12 col-sm-4">
                                                    <div className="info-label">Total en devoluciones</div>
                                                    <div className="chip-count w-100 text-center">{formatMoney(histData.totalDevoluciones || 0, currencySymbol)}</div>
                                                </div>
                                            </div>
                                            <div className="mb-3">
                                                <div className="info-label mb-1">Resumen por metodo de pago</div>
                                                <div className="d-flex flex-wrap gap-2">
                                                        {(histData.metodosPago || []).length === 0 && (
                                                            <span className="text-muted small">Sin movimientos en la fecha.</span>
                                                        )}
                                                        {(histData.metodosPago || []).map((m, idx) => (
                                                            <span key={`${m.metodo || 'met'}-${idx}`} className="chip-count">
                                                                <span className="chip-metodo-label">{m.metodo || 'Otro'}</span>
                                                                <span className="chip-metodo-valor">{formatMoney(m.total || 0, currencySymbol)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <DataTable
                                                    columns={columnasHistorialDia}
                                                    data={histData.ventas || []}
                                                    dense
                                                    highlightOnHover
                                                    fixedHeader
                                                    fixedHeaderScrollHeight="250px"
                                                    customStyles={dataTableStyles}
                                                    noDataComponent={<div className="text-muted py-3">Sin ventas registradas en esta fecha.</div>}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            )}

            {showConfirm && (
                <div className="inventory-modal-backdrop" onClick={() => setShowConfirm(false)}>
                    <div className="inventory-modal inventory-modal-lg confirm-venta-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-modal-header">
                            <div className="inventory-modal-title-badge">
                                <i className="bi bi-receipt-cutoff"></i>
                                Confirmar factura
                            </div>
                            <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setShowConfirm(false)}></button>
                        </div>
                        <div className="inventory-modal-body">
                            <div className="row g-3 mb-2">
                                <div className="col-md-4">
                                    <div className="info-label">Cliente</div>
                                    <div className="chip-soft">
                                        <i className="bi bi-person-badge me-1"></i>
                                        {clienteSel ? `${clienteSel.Nombres} ${clienteSel.Apellidos}` : 'Consumidor final'}
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="info-label">Forma de pago</div>
                                    <div className="chip-soft">
                                        <i className="bi bi-credit-card-2-front me-1"></i>
                                        {formaPago}
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="info-label">Estado</div>
                                    <div className="chip-strong">
                                        <i className="bi bi-check2-circle me-1"></i>
                                        {estado}
                                    </div>
                                </div>
                            </div>

                            <div className="table-responsive mb-1">
                                <table className="table table-sm align-middle">
                                    <thead>
                                        <tr>
                                            <th className='tabla-confirmarFactura'>Producto</th>
                                            <th className='tabla-confirmarFactura'>Marca</th>
                                            <th className='tabla-confirmarFactura' style={{ width: 150 }}>Cantidad</th>
                                            <th className='tabla-confirmarFactura' style={{ width: 150 }}>Itbis</th>
                                            <th className='tabla-confirmarFactura' style={{ width: 200 }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const loteSel = it.lotes.find(l => l.loteId === it.loteId);
                                            const factor = Math.max(1, Number(loteSel?.cantidadUnidadesMinimas || it.factorUnidad || 1));
                                            const unidades = it.modo === 'empaque'
                                                ? Number(it.cantEmpaques || 0) * factor
                                                : Number(it.cantUnidadesMinimas || 0);
                                            const precioEmpaqueBase = Number(loteSel?.precioVenta || 0);
                                            const rawDesc = Number(loteSel?.descuento || loteSel?.porcentajeDescuentoEmpaque || 0);
                                            const descPct = rawDesc >= 1 ? rawDesc / 100 : rawDesc;
                                            const descEmp = it.modo === 'empaque' ? Math.min(1, Math.max(0, descPct)) : 0;
                                            const precioEmpaque = precioEmpaqueBase * (1 - descEmp);
                                            const precioUnidadAplicada = factor > 0
                                                ? (it.modo === 'empaque' ? precioEmpaque / factor : precioEmpaqueBase / factor)
                                                : precioEmpaqueBase;
                                            const sub = number(unidades * precioUnidadAplicada, 2);
                                            const impuestoPct = Number(it.impuesto ?? loteSel?.impuesto ?? 0);
                                            const imp = number(sub * (impuestoPct / 100), 2);
                                            return (
                                                <tr key={it.lineId || idx}>
                                                    <td className='tabla-confirmarFactura'>
                                                        <div className="fw-semibold">{it.nombre}</div>
                                                        <div className="text-muted small">{it.presentacion}</div>
                                                    </td >
                                                    <td className='tabla-confirmarFactura'>{loteSel?.marcaNombre || it.marcaNombre || ""}</td>
                                                    <td className='tabla-confirmarFactura'>{it.modo === 'empaque' ? `${it.cantEmpaques || 0} empaque(s)` : `${it.cantUnidadesMinimas || 0} unidades`}</td>
                                                    <td className='tabla-confirmarFactura'>{impuestoPct.toFixed(2)}%</td>
                                                    <td className='tabla-confirmarFactura'>{formatMoney(number(sub + imp, 2), currencySymbol)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="d-flex flex-wrap gap-4 align-items-center mt-2">
                                <div className="totales-chip-inline">
                                    <span className="info-label mb-0 me-2">Subtotal</span>
                                    <span className="chip-soft">{formatMoney(subtotal, currencySymbol)}</span>
                                </div>
                                <div className="totales-chip-inline">
                                    <span className="info-label mb-0 me-2">Impuestos</span>
                                    <span className="chip-soft">{formatMoney(impuestoTotal, currencySymbol)}</span>
                                </div>
                                <div className="totales-chip-inline">
                                    <span className="info-label mb-0 me-2">Descuento</span>
                                    <span className="chip-soft">-{formatMoney(descuento, currencySymbol)}</span>
                                </div>
                                <div className="totales-chip-inline">
                                    <span className="info-label mb-0 me-2">Total</span>
                                    <span className="chip-strong">{formatMoney(total, currencySymbol)}</span>
                                </div>
                            </div>

                            {formaPago === 'Efectivo' && montoRecibidoIngresado && Number.isFinite(montoRecibidoNumber) && (
                                <div className="d-flex flex-wrap gap-4 align-items-center mt-2">
                                    <div className="totales-chip-inline">
                                        <span className="info-label mb-0 me-2">Recibido</span>
                                        <span className="chip-soft">{formatMoney(montoRecibidoNumber, currencySymbol)}</span>
                                    </div>
                                    {cambio !== null && (
                                        <div className="totales-chip-inline">
                                            <span className="info-label mb-0 me-2">Cambio</span>
                                            <span className="chip-soft">{formatMoney(cambio, currencySymbol)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="inventory-modal-footer">
                            <ActionButton
                                variant="outline-danger"
                                icon="bi bi-x-lg"
                                onClick={() => setShowConfirm(false)}
                                text="Cancelar"
                            />
                            <ActionButton
                                variant="primary"
                                icon="bi bi-receipt"
                                onClick={() => { setShowConfirm(false); onFinalizar(); }}
                                text="Confirmar y facturar"
                            />
                        </div>
                    </div>
                </div>
            )}

            <Toast key={toastKey} message={toastMsg} type={toastType} />
        </div>
    );
}
