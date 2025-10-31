// src/pages/ProductosPage2.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./ProductosPage.css";
import DataTable from "react-data-table-component";
import Toast from "../components/recursos/Toast";
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
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [toastKey, setToastKey] = useState(Date.now());
  const [busqueda, setBusqueda] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [unidadesEmpaque, setUnidadesEmpaque] = useState([]);
  const [unidadesMinima, setUnidadesMinima] = useState([]);

  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    Nombre: "",
    Presentacion: "",
    CategoriaID: "",
    UnidadMedidaEmpaqueID: "",
    UnidadMedidaMinimaID: "",
    CantidadUnidadMinimaXEmpaque: "1",
    StockMinimo: 1,
    Activo: true,
  });
  const [errors, setErrors] = useState({});

  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [showModalActivar, setShowModalActivar] = useState(false);
  const [productoPorActivar, setProductoPorActivar] = useState(null);

  useEffect(() => {
    (async () => {
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
      } catch {
        setMensaje("Error cargando productos");
        setTipoMensaje("error");
        setToastKey(Date.now());
      }
    })();
  }, []);

  useEffect(() => { if (mensaje) setToastKey(Date.now()); }, [mensaje]);

  function onEdit(p) {
    setEditando(p);
    setForm({
      Nombre: p.Nombre || "",
      Presentacion: p.Presentacion || "",
      CategoriaID: String(p.CategoriaID || ""),
      UnidadMedidaEmpaqueID: String(p.UnidadMedidaEmpaqueID || ""),
      UnidadMedidaMinimaID: String(p.UnidadMedidaMinimaID || ""),
      CantidadUnidadMinimaXEmpaque: String((p.CantidadUnidadMinimaXEmpaque ?? 1) || 1),
      StockMinimo: Number((p.StockMinimo ?? 1) || 1),
      Activo: !!p.Activo,
    });
    setErrors({});
  }

  function onCancel() {
  setEditando(null);
  setForm({
    Nombre: "",
    Presentacion: "",
    CategoriaID: "",
    UnidadMedidaEmpaqueID: "",
    UnidadMedidaMinimaID: "",
    CantidadUnidadMinimaXEmpaque: "1",
    StockMinimo: 1,
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
      case "CantidadUnidadMinimaXEmpaque": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) err.CantidadUnidadMinimaXEmpaque = "Ingrese una cantidad valida.";
        break;
      }
      case "StockMinimo": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 1) err.StockMinimo = "Ingrese una cantidad valida.";
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
    if (fieldError[name]) next[name] = fieldError[name]; else delete next[name];
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
    Object.entries(form).forEach(([k, val]) => { v = { ...v, ...validateField(k, val) }; });
    setErrors(v);
    if (Object.keys(v).length) return;

    try {
      const payload = {
        Nombre: form.Nombre,
        Presentacion: form.Presentacion,
        CategoriaID: Number(form.CategoriaID),
        UnidadMedidaEmpaqueID: Number(form.UnidadMedidaEmpaqueID),
        UnidadMedidaMinimaID: Number(form.UnidadMedidaMinimaID),
        CantidadUnidadMinimaXEmpaque: Number(form.CantidadUnidadMinimaXEmpaque),
        StockMinimo: Number(form.StockMinimo),
        Activo: !!form.Activo,
      };
      if (editando) {
        await updateProducto(editando.ProductoID, payload);
        setMensaje("Producto actualizado");
      } else {
        await createProducto(payload);
        setMensaje("Producto creado");
      }
      setTipoMensaje("success"); setToastKey(Date.now()); onCancel();
      const data = await getProductos(); setItems(data);
    } catch (e) {
      setMensaje(typeof e?.message === 'string' ? e.message : 'Error al guardar'); setTipoMensaje('error'); setToastKey(Date.now());
    }
  }

  const abrirModalEliminar = (p) => { setProductoSeleccionado(p); setShowModalEliminar(true); };
  const confirmarEliminar = async () => {
    if (!productoSeleccionado) return;
    try { await deleteProducto(productoSeleccionado.ProductoID); setMensaje('Producto desactivado'); setTipoMensaje('success'); setToastKey(Date.now()); const data = await getProductos(); setItems(data); }
    catch (e) { setMensaje(typeof e?.message === 'string' ? e.message : 'No se pudo desactivar'); setTipoMensaje('error'); setToastKey(Date.now()); }
    finally { setShowModalEliminar(false); setProductoSeleccionado(null); }
  };
  const cancelarEliminar = () => { setShowModalEliminar(false); setProductoSeleccionado(null); };

  const abrirModalActivar = (p) => { setProductoPorActivar(p); setShowModalActivar(true); };
  const confirmarActivar = async () => {
    if (!productoPorActivar) return;
    try { await updateProducto(productoPorActivar.ProductoID, { Activo: true }); setMensaje('Producto activado'); setTipoMensaje('success'); setToastKey(Date.now()); const data = await getProductos(); setItems(data); }
    catch (e) { setMensaje(typeof e?.message === 'string' ? e.message : 'Error al activar'); setTipoMensaje('error'); setToastKey(Date.now()); }
    finally { setShowModalActivar(false); setProductoPorActivar(null); }
  };
  const cancelarActivar = () => { setShowModalActivar(false); setProductoPorActivar(null); };

  const columnas = [
    { name: 'ID', selector: (r) => r.ProductoID, sortable: true, width: '80px' },
    { name: 'Nombre', selector: (r) => r.Nombre, sortable: true, width: '160px', wrap: true },
    { name: 'Presentación', selector: (r) => r.Presentacion || '', sortable: true, width: '160px', wrap: true },
    { name: 'UM Empaque', selector: (r) => r.UnidadMedidaEmpaque || '', sortable: true, width: '140px' },
    { name: 'UM Mínima', selector: (r) => r.UnidadMedidaMinima || '', sortable: true, width: '140px' },
    { name: 'Cant. por Empaque', selector: (r) => r.CantidadUnidadMinimaXEmpaque, sortable: true, width: '160px' },
    { name: 'Stock', selector: (r) => r.Stock, sortable: true, width: '100px' },
    { name: 'Stock Mín.', selector: (r) => r.StockMinimo, sortable: true, width: '120px' },
    {
      name: 'Activo', selector: (r) => (r.Activo ? 'Sí' : 'No'), sortable: true, width: '100px'
    },
    {
      name: 'Acciones', width: '120px',
      cell: (row) => (
        <div className="btn-accion-contenedor">
          <button className="btn btn-edit btn-sm me-1" onClick={() => onEdit(row)} title="Editar">
            <i className="bi bi-pencil-fill"></i>
          </button>
          {row.Activo ? (
            <button className="btn btn-delete btn-sm" onClick={() => abrirModalEliminar(row)} title="Desactivar">
              <i className="bi bi-trash3-fill"></i>
            </button>
          ) : (
            <button className="btn btn-sm btn-success" onClick={() => abrirModalActivar(row)} title="Activar">
              <i className="bi bi-check-circle-fill"></i>
            </button>
          )}
        </div>
      )
    }
  ];

  const itemsFiltrados = useMemo(() => {
    const q = (busqueda || '').toLowerCase(); if (!q) return items;
    return items.filter((p) =>
      (p.Nombre || '').toLowerCase().includes(q) ||
      (p.Presentacion || '').toLowerCase().includes(q) ||
      (p.UnidadMedidaEmpaque || '').toLowerCase().includes(q) ||
      (p.UnidadMedidaMinima || '').toLowerCase().includes(q)
    );
  }, [items, busqueda]);

  // paginación configurada inline en DataTable

  return (
    <div className="container productos-page-container py-3">
      <h1 className="page-title display-5 fw-bold text-center opacity-75 mb-3">Productos</h1>
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />
      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body products-form-container">
              <h5 className="card-title text-center">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h5>
              <form onSubmit={handleSubmit} noValidate className="row g-2">
                <div className="col-12">
                  <label className="form-label">Nombre <span className="obligatorio">*</span></label>
                  <input name="Nombre" value={form.Nombre} onChange={handleChange} onBlur={handleBlur} className={`form-control ${errors.Nombre ? 'is-invalid' : ''}`} placeholder="Paracetamol" />
                  {errors.Nombre && <div className="invalid-feedback">{errors.Nombre}</div>}
                </div>
                <div className="col-12">
                  <label className="form-label">Presentación</label>
                  <textarea name="Presentacion" rows={1} value={form.Presentacion} onChange={handleChange} onBlur={handleBlur} className={`form-control ${errors.Presentacion ? 'is-invalid' : ''}`} placeholder="500 mg x 10 tabletas" />
                  {errors.Presentacion && <div className="invalid-feedback">{errors.Presentacion}</div>}
                </div>
                <div className="col-8">
                  <label className="form-label">Categoría <span className="obligatorio">*</span></label>
                  <select name="CategoriaID" className={`form-select ${errors.CategoriaID ? 'is-invalid' : ''}`} value={form.CategoriaID} onChange={handleChange}>
                    <option value="">Seleccionar</option>
                    {categorias.map((c) => (
                      <option key={c.CategoriaID} value={c.CategoriaID}>{c.NombreCategoria}</option>
                    ))}
                  </select>
                  {errors.CategoriaID && <div className="invalid-feedback">{errors.CategoriaID}</div>}
                </div>
                <div className="col-4">
                  <label className="form-label">Stock mínimo <span className="obligatorio">*</span></label>
                  <input name="StockMinimo" type="number" min={1} className={`form-control ${errors.StockMinimo ? 'is-invalid' : ''}`} value={form.StockMinimo} onChange={handleChange} onBlur={handleBlur} placeholder="Ej. 5" />
                  {errors.StockMinimo && <div className="invalid-feedback">{errors.StockMinimo}</div>}
                </div>
                <div className="col-4">
                  <label className="form-label">Unidad medida empaque <span className="obligatorio">*</span></label>
                  <select name="UnidadMedidaEmpaqueID" className={`form-select ${errors.UnidadMedidaEmpaqueID ? 'is-invalid' : ''}`} value={form.UnidadMedidaEmpaqueID} onChange={handleChange} onBlur={handleBlur}>
                    <option value="">Seleccionar</option>
                    {unidadesEmpaque.map((u) => (<option key={u.UnidadMedidaID} value={u.UnidadMedidaID}>{u.Nombre}</option>))}
                  </select>
                  {errors.UnidadMedidaEmpaqueID && <div className="invalid-feedback">{errors.UnidadMedidaEmpaqueID}</div>}
                </div>
                <div className="col-4">
                  <label className="form-label">Unidad medida mínima <span className="obligatorio">*</span></label>
                  <select name="UnidadMedidaMinimaID" className={`form-select ${errors.UnidadMedidaMinimaID ? 'is-invalid' : ''}`} value={form.UnidadMedidaMinimaID} onChange={handleChange} onBlur={handleBlur}>
                    <option value="">Seleccionar</option>
                    {unidadesMinima.map((u) => (<option key={u.UnidadMedidaID} value={u.UnidadMedidaID}>{u.Nombre}</option>))}
                  </select>
                  {errors.UnidadMedidaMinimaID && <div className="invalid-feedback">{errors.UnidadMedidaMinimaID}</div>}
                </div>
                <div className="col-4">
                  <label className="form-label">Unidades por empaque <span className="obligatorio">*</span></label>
                  <input name="CantidadUnidadMinimaXEmpaque" type="number" min={1} className={`form-control ${errors.CantidadUnidadMinimaXEmpaque ? 'is-invalid' : ''}`} value={form.CantidadUnidadMinimaXEmpaque} onChange={handleChange} onBlur={handleBlur} placeholder="Ej. 10" />
                  {errors.CantidadUnidadMinimaXEmpaque && <div className="invalid-feedback">{errors.CantidadUnidadMinimaXEmpaque}</div>}
                </div>
                <div className="col-12 col-md-6 d-flex">
                  <div className="toggle-container">
                    <label className="toggle-switch">
                      <input type="checkbox" name="Activo" checked={form.Activo} onChange={handleChange} />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">Activo</span>
                  </div>
                </div>
                <div className="col-12 mt-2">
                  <div className="grupo-botones">
                    <button className="btn btn-submit" type="submit">{editando ? 'Actualizar' : 'Crear'}</button>
                    {editando && (<button className="btn btn-cancelar" type="button" onClick={onCancel}>Cancelar</button>)}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm tabla-usuarios-contenedor">
            <div className="card-body">
              <div className="d-flex align-items-center mb-2">
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-search"></i></span>
                  <input placeholder="Buscar..." className="form-control" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
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
                paginationComponentOptions={{ rowsPerPageText: 'Filas:', rangeSeparatorText: 'de' }}
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10, 20, 50]}
                conditionalRowStyles={[{ when: (row) => !row.Activo, style: { opacity: 0.5 } }]}
                noDataComponent="No se encontraron productos que coincidan con la búsqueda"
                customStyles={{ cells: { style: { whiteSpace: 'normal !important', overflow: 'visible !important', wordWrap: 'break-word !important', textOverflow: 'initial !important' } }, headCells: { style: { whiteSpace: 'normal !important' } } }}
              />
            </div>
          </div>
        </div>
      </div>

      {showModalEliminar && productoSeleccionado && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Desactivación</h3>
            <p>¿Desea desactivar el producto <strong>{productoSeleccionado.Nombre}</strong>?</p>
            <div className="modal-buttons">
              <button className="btn btn-confirm" onClick={confirmarEliminar}>Confirmar</button>
              <button className="btn btn-cancel" onClick={cancelarEliminar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showModalActivar && productoPorActivar && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Activación</h3>
            <p>¿Desea activar el producto <strong>{productoPorActivar.Nombre}</strong>?</p>
            <div className="modal-buttons">
              <button className="btn btn-confirm" onClick={confirmarActivar}>Confirmar</button>
              <button className="btn btn-cancel" onClick={cancelarActivar}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
