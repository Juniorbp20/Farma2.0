// src/pages/ProductosPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./ProductosPage.css";
import DataTable from "react-data-table-component";
import ConfirmModal from "../components/ConfirmModal";
import TabBar from "../components/TabBar";
import Toast from "../components/recursos/Toast";
import ActionButton from "../components/ActionButton";
import { getUser } from "../services/authService";
import { buildPermissions } from "../utils/permissions";
import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getCategoriasProductos,
  getUnidadesMedida,
} from "../services/productsService";

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [unidadesEmpaque, setUnidadesEmpaque] = useState([]);
  const [unidadesMinima, setUnidadesMinima] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [toastKey, setToastKey] = useState(Date.now());
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null);
  const [vistaActual, setVistaActual] = useState("ver");

  const [form, setForm] = useState({
    Nombre: "",
    Presentacion: "",
    CategoriaID: "",
    UnidadMedidaEmpaqueID: "",
    UnidadMedidaMinimaID: "",
    StockMinimo: 1,
    Impuesto: 0,
    Activo: true,
  });
  const [errors, setErrors] = useState({});

  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [showModalActivar, setShowModalActivar] = useState(false);
  const [productoPorActivar, setProductoPorActivar] = useState(null);

  const productsTabOptions = [
    { value: "ver", label: "Ver Productos", icon: "bi bi-box-seam" },
    { value: "gestionar", label: "Gestionar Productos", icon: "bi bi-plus-circle" },
  ];

  useEffect(() => {
    const u = getUser();
    cargarDatos();
  }, []);

  useEffect(() => {
    if (mensaje) {
      setToastKey(Date.now());
    }
  }, [mensaje]);

  async function cargarDatos() {
    try {
      const [data, cats, ume, umm] = await Promise.all([
        getProductos(),
        getCategoriasProductos(),
        getUnidadesMedida("empaque"),
        getUnidadesMedida("minima"),
      ]);
      setItems(data);
      setCategorias(cats);
      setUnidadesEmpaque(ume);
      setUnidadesMinima(umm);
    } catch (e) {
      setMensaje("Error cargando productos");
      setTipoMensaje("error");
    }
  }

  const refrescarProductos = async () => {
    try {
      const data = await getProductos();
      setItems(data);
    } catch {
      setMensaje("No se pudo refrescar la lista");
      setTipoMensaje("error");
    }
  };

  const perms = useMemo(() => buildPermissions(getUser()), []);
  const canManageProductos = perms.hasAny(['productos:create', 'productos:update', 'productos:delete']);
  const canViewProductos = perms.can('productos:read');

  useEffect(() => {
    if (!canManageProductos && vistaActual === "gestionar") {
      setVistaActual("ver");
    }
  }, [canManageProductos, vistaActual]);

  const visibleTabs = useMemo(
    () => (canManageProductos ? productsTabOptions : productsTabOptions.filter((t) => t.value === "ver")),
    [canManageProductos]
  );

  const handleSelectTab = (tab) => {
    if (tab === "gestionar" && !canManageProductos) return;
    setVistaActual(tab);
  };

  function onEdit(prod) {
    setEditando(prod);
    setVistaActual("gestionar");
    setForm({
      Nombre: prod.Nombre || "",
      Presentacion: prod.Presentacion || "",
      CategoriaID: String(prod.CategoriaID || ""),
      UnidadMedidaEmpaqueID: String(prod.UnidadMedidaEmpaqueID || ""),
      UnidadMedidaMinimaID: String(prod.UnidadMedidaMinimaID || ""),
      StockMinimo: Number((prod.StockMinimo ?? 1) || 1),
      Impuesto: Number(prod.Impuesto ?? 0),
      Activo: !!prod.Activo,
    });
    setErrors({});
  }

  function onCancel() {
    setEditando(null);
    setVistaActual("ver");
    setForm({
      Nombre: "",
      Presentacion: "",
      CategoriaID: "",
      UnidadMedidaEmpaqueID: "",
      UnidadMedidaMinimaID: "",
      StockMinimo: 1,
      Impuesto: 0,
      Activo: true,
    });
    setErrors({});
  }

  function validateField(name, value) {
    const err = {};
    switch (name) {
      case "CategoriaID":
        if (!value) err.CategoriaID = "Seleccione una categoria";
        break;
      case "Nombre": {
        const v = (value || "").toString();
        if (!v.trim()) err.Nombre = "El nombre es obligatorio.";
        else if (v.length > 150) err.Nombre = "Maximo 150 caracteres.";
        break;
      }
      case "Presentacion": {
        const v = (value || "").toString();
        if (v.length > 100) err.Presentacion = "Maximo 100 caracteres.";
        break;
      }
      case "UnidadMedidaEmpaqueID":
        if (!value) err.UnidadMedidaEmpaqueID = "Seleccione una unidad";
        break;
      case "UnidadMedidaMinimaID":
        if (!value) err.UnidadMedidaMinimaID = "Seleccione una unidad";
        break;
      case "StockMinimo": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) err.StockMinimo = "Ingrese una cantidad valida.";
        break;
      }
      case "Impuesto": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 100) err.Impuesto = "Impuesto 0 a 100.";
        break;
      }
      default:
        break;
    }
    return err;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((prev) => ({ ...prev, [name]: newValue }));
    const fieldError = validateField(name, newValue);
    setErrors((prev) => {
      const next = { ...prev };
      if (fieldError[name]) next[name] = fieldError[name];
      else delete next[name];
      return next;
    });
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, ...validateField(name, value) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    let v = {};
    Object.entries(form).forEach(([k, val]) => {
      v = { ...v, ...validateField(k, val) };
    });
    setErrors(v);
    if (Object.keys(v).length) return;

    try {
      const payload = {
        Nombre: form.Nombre,
        Presentacion: form.Presentacion,
        CategoriaID: Number(form.CategoriaID),
        UnidadMedidaEmpaqueID: Number(form.UnidadMedidaEmpaqueID),
        UnidadMedidaMinimaID: Number(form.UnidadMedidaMinimaID),
        StockMinimo: Number(form.StockMinimo),
        Impuesto: Number(form.Impuesto ?? 0),
        Activo: !!form.Activo,
      };
      if (editando) {
        await updateProducto(editando.ProductoID, payload);
        setMensaje("Producto actualizado");
      } else {
        await createProducto(payload);
        setMensaje("Producto creado");
      }
      setTipoMensaje("success");
      setToastKey(Date.now());
      onCancel();
      await refrescarProductos();
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : "Error al guardar";
      setMensaje(msg);
      setTipoMensaje("error");
      setToastKey(Date.now());
    }
  }

  const abrirModalEliminar = (p) => {
    setProductoSeleccionado(p);
    setShowModalEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!productoSeleccionado) return;
    try {
      await deleteProducto(productoSeleccionado.ProductoID);
      setMensaje("Producto desactivado");
      setTipoMensaje("success");
      await refrescarProductos();
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : "No se pudo desactivar";
      setMensaje(msg);
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalEliminar(false);
      setProductoSeleccionado(null);
    }
  };

  const cancelarEliminar = () => {
    setShowModalEliminar(false);
    setProductoSeleccionado(null);
  };

  const abrirModalActivar = (p) => {
    setProductoPorActivar(p);
    setShowModalActivar(true);
  };

  const confirmarActivar = async () => {
    if (!productoPorActivar) return;
    try {
      await updateProducto(productoPorActivar.ProductoID, { Activo: true });
      setMensaje("Producto activado");
      setTipoMensaje("success");
      await refrescarProductos();
    } catch (e) {
      const msg = typeof e?.message === "string" ? e.message : "Error al activar";
      setMensaje(msg);
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalActivar(false);
      setProductoPorActivar(null);
    }
  };

  const cancelarActivar = () => {
    setShowModalActivar(false);
    setProductoPorActivar(null);
  };

  const columnas = useMemo(() => {
    const base = [
      { name: "ID", selector: (r) => r.ProductoID, sortable: true, width: "80px" },
      { name: "Nombre", selector: (r) => r.Nombre, sortable: true, width: "160px", wrap: true },
      { name: "Presentacion", selector: (r) => r.Presentacion || "", sortable: true, width: "160px", wrap: true },
      { name: "UM Empaque", selector: (r) => r.UnidadMedidaEmpaque || "", sortable: true, width: "140px" },
      { name: "UM Minima", selector: (r) => r.UnidadMedidaMinima || "", sortable: true, width: "140px" },
      { name: "Stock", selector: (r) => r.Stock, sortable: true, width: "100px" },
      { name: "Stock Min.", selector: (r) => r.StockMinimo, sortable: true, width: "120px" },
      {
        name: "Imp. %",
        selector: (r) => Number(r.Impuesto ?? 0),
        sortable: true,
        width: "100px",
        right: true,
        cell: (r) => (
          <span className="fw-semibold">{Number(r.Impuesto ?? 0).toFixed(2)}%</span>
        ),
      },
      { name: "Activo", selector: (r) => (r.Activo ? "Si" : "No"), sortable: true, width: "100px" },
    ];

    if (canManageProductos) {
      base.push({
        name: "Acciones",
        width: "120px",
        cell: (row) => (
          <div className="table-action-group btn-group btn-group-sm">
            <button
              className="btn btn-outline-primary"
              onClick={() => onEdit(row)}
              title="Editar"
            >
              <i className="bi bi-pencil"></i>
            </button>
            {row.Activo ? (
              <button
                className="btn btn-outline-danger"
                onClick={() => abrirModalEliminar(row)}
                title="Desactivar"
              >
                <i className="bi bi-trash3"></i>
              </button>
            ) : (
              <button
                className="btn btn-outline-success"
                onClick={() => abrirModalActivar(row)}
                title="Activar"
              >
                <i className="bi bi-check-circle"></i>
              </button>
            )}
          </div>
        ),
      });
    }

    return base;
  }, [canManageProductos]);

  const itemsFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      (p.Nombre || "").toLowerCase().includes(q) ||
      (p.Presentacion || "").toLowerCase().includes(q) ||
      String(p.Impuesto ?? "").toLowerCase().includes(q) ||
      (p.UnidadMedidaEmpaque || "").toLowerCase().includes(q) ||
      (p.UnidadMedidaMinima || "").toLowerCase().includes(q)
    );
  }, [items, busqueda]);

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
  };

  const productosTableStyles = {
    headCells: {
      style: {
        backgroundColor: "#fff",
        fontWeight: 600,
        whiteSpace: "normal !important",
      },
    },
    cells: {
      style: {
        whiteSpace: "normal !important",
        overflow: "visible !important",
        wordWrap: "break-word !important",
        textOverflow: "initial !important",
      },
    },
  };

  return (
    <div className="container productos-page-container py-3">
      {!canViewProductos && (
        <div className="alert alert-warning">No tienes acceso a Productos.</div>
      )}
      <div className="d-flex justify-content-end pb-2 mb-3 productos-menu">
        <TabBar
          tabs={visibleTabs}
          active={vistaActual}
          onSelect={handleSelectTab}
          ariaLabel="Secciones de productos"
        />
      </div>
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      {vistaActual === "gestionar" && (
        <div className="productos-card products-form-container mb-3">
          <h3 className="mb-3 text-center">
            {editando ? "Editar Producto" : "Nuevo Producto"}
          </h3>
          <form onSubmit={handleSubmit} className="row g-2" noValidate>
            <div className="col-12">
              <label className="form-label">
                Nombre <span className="obligatorio">*</span>
              </label>
              <input
                name="Nombre"
                value={form.Nombre}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${errors.Nombre ? "is-invalid" : ""}`}
                placeholder="Paracetamol"
              />
              {errors.Nombre && <div className="invalid-feedback">{errors.Nombre}</div>}
            </div>

            <div className="col-12">
              <label className="form-label">Presentacion</label>
              <textarea
                name="Presentacion"
                rows={1}
                value={form.Presentacion}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${errors.Presentacion ? "is-invalid" : ""}`}
                placeholder="500 mg x 10 tabletas"
              />
              {errors.Presentacion && (
                <div className="invalid-feedback">{errors.Presentacion}</div>
              )}
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">
                Categoria <span className="obligatorio">*</span>
              </label>
              <select
                name="CategoriaID"
                className={`form-select ${errors.CategoriaID ? "is-invalid" : ""}`}
                value={form.CategoriaID}
                onChange={handleChange}
              >
                <option value="">Seleccionar</option>
                {categorias.map((c) => (
                  <option key={c.CategoriaID} value={c.CategoriaID}>
                    {c.NombreCategoria}
                  </option>
                ))}
              </select>
              {errors.CategoriaID && (
                <div className="invalid-feedback">{errors.CategoriaID}</div>
              )}
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">
                Stock minimo <span className="obligatorio">*</span>
              </label>
              <input
                name="StockMinimo"
                type="number"
                min={1}
                className={`form-control ${errors.StockMinimo ? "is-invalid" : ""}`}
                value={form.StockMinimo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej. 5"
              />
              {errors.StockMinimo && (
                <div className="invalid-feedback">{errors.StockMinimo}</div>
              )}
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">Impuesto (%)</label>
              <input
                name="Impuesto"
                type="number"
                min={0}
                max={100}
                step="0.01"
                className={`form-control ${errors.Impuesto ? "is-invalid" : ""}`}
                value={form.Impuesto}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ej. 18"
              />
              {errors.Impuesto && <div className="invalid-feedback">{errors.Impuesto}</div>}
            </div>


            <div className="col-12 col-md-4">
              <label className="form-label">
                Unidad medida empaque <span className="obligatorio">*</span>
              </label>
              <select
                name="UnidadMedidaEmpaqueID"
                className={`form-select ${errors.UnidadMedidaEmpaqueID ? "is-invalid" : ""}`}
                value={form.UnidadMedidaEmpaqueID}
                onChange={handleChange}
                onBlur={handleBlur}
              >
                <option value="">Seleccionar</option>
                {unidadesEmpaque.map((u) => (
                  <option key={u.UnidadMedidaID} value={u.UnidadMedidaID}>
                    {u.Nombre}
                  </option>
                ))}
              </select>
              {errors.UnidadMedidaEmpaqueID && (
                <div className="invalid-feedback">{errors.UnidadMedidaEmpaqueID}</div>
              )}
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">
                Unidad medida minima <span className="obligatorio">*</span>
              </label>
              <select
                name="UnidadMedidaMinimaID"
                className={`form-select ${errors.UnidadMedidaMinimaID ? "is-invalid" : ""}`}
                value={form.UnidadMedidaMinimaID}
                onChange={handleChange}
                onBlur={handleBlur}
              >
                <option value="">Seleccionar</option>
                {unidadesMinima.map((u) => (
                  <option key={u.UnidadMedidaID} value={u.UnidadMedidaID}>
                    {u.Nombre}
                  </option>
                ))}
              </select>
              {errors.UnidadMedidaMinimaID && (
                <div className="invalid-feedback">{errors.UnidadMedidaMinimaID}</div>
              )}
            </div>

            <div className="col-12 col-md-4 d-flex justify-content-center">
              <div className="toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    name="Activo"
                    checked={form.Activo}
                    onChange={handleChange}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">Activo</span>
              </div>
            </div>

            <div className="col-12">
              <div className="grupo-botones">
                {editando && (
                  <ActionButton
                    type="button"
                    variant="outline-danger"
                    icon="bi bi-x-circle"
                    text="Cancelar"
                    onClick={onCancel}
                  />
                )}
                <ActionButton
                  type="submit"
                  variant="primary"
                  icon={editando ? "bi bi-arrow-clockwise" : "bi bi-plus-circle"}
                  text={editando ? "Actualizar" : "Crear"}
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {vistaActual === "ver" && (
        <div className="productos-card tabla-productos-contenedor">
          <div className="productos-table-panel">
            <div className="productos-search-wrapper mb-2">
              <input
                placeholder="Buscar producto..."
                className="productos-search-field"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <DataTable
              columns={columnas}
              data={itemsFiltrados}
              pagination
              highlightOnHover
              responsive
              striped
              className="table table-striped table-bordered table-hover"
              noWrap={false}
              paginationComponentOptions={paginacionOpciones}
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 30, 50]}
              conditionalRowStyles={[{ when: (row) => !row.Activo, style: { opacity: 0.5 } }]}
              noDataComponent="No se encontraron productos que coincidan con la busqueda"
              fixedHeader
              fixedHeaderScrollHeight="45vh"
              persistTableHead
              customStyles={productosTableStyles}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showModalEliminar && !!productoSeleccionado}
        title="Confirmar Desactivacion"
        message={
          <>
            Desea desactivar el producto{" "}
            <strong>{productoSeleccionado?.Nombre}</strong>?
          </>
        }
        onCancel={cancelarEliminar}
        onConfirm={confirmarEliminar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />

      <ConfirmModal
        isOpen={showModalActivar && !!productoPorActivar}
        title="Confirmar Activacion"
        message={
          <>
            Desea activar el producto{" "}
            <strong>{productoPorActivar?.Nombre}</strong>?
          </>
        }
        onCancel={cancelarActivar}
        onConfirm={confirmarActivar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />
    </div>
  );
}
