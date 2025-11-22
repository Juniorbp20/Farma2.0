// src/pages/ProveedoresPage.jsx
import React, { useEffect, useState } from "react";
import "./ProveedoresPage.css";
import DataTable from "react-data-table-component";
import ConfirmModal from "../components/ConfirmModal";
import ActionButton from "../components/ActionButton";
import Toast from "../components/recursos/Toast";
import TabBar from "../components/TabBar";
import {
  getProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "../services/proveedoresService";

function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [toastKey, setToastKey] = useState(Date.now());
  const [busqueda, setBusqueda] = useState("");
  const [vistaActual, setVistaActual] = useState("ver");

  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    NombreProveedor: "",
    Contacto: "",
    Email: "",
    Telefono: "",
    Activo: true,
  });
  const [errors, setErrors] = useState({});

  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [showModalActivar, setShowModalActivar] = useState(false);
  const [proveedorPorActivar, setProveedorPorActivar] = useState(null);

  const proveedorTabs = [
    { value: "ver", label: "Ver Proveedores", icon: "bi bi-truck" },
    { value: "gestionar", label: "Gestionar Proveedores", icon: "bi bi-person-plus" },
  ];

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (mensaje) setToastKey(Date.now());
  }, [mensaje]);

  async function cargar() {
    const list = await getProveedores();
    setProveedores(list);
  }

  function validateField(name, value) {
    const e = {};
    switch (name) {
      case "NombreProveedor":
        if (!value.trim()) e.NombreProveedor = "El nombre es obligatorio.";
        else if (value.length > 150) e.NombreProveedor = "Maximo 150 caracteres.";
        break;
      case "Contacto":
        if (value && value.length > 100) e.Contacto = "Maximo 100 caracteres.";
        break;
      case "Email":
        if (value && value.length > 100) e.Email = "Maximo 100 caracteres.";
        break;
      case "Telefono":
        if (value && value.length > 20) e.Telefono = "Maximo 20 caracteres.";
        break;
      default:
        break;
    }
    return e;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((f) => ({ ...f, [name]: newValue }));
    const fe = validateField(name, newValue);
    setErrors((prev) => {
      const next = { ...prev };
      Object.entries(fe).forEach(([k, v]) => {
        if (v) next[k] = v;
        else delete next[k];
      });
      return next;
    });
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    const fe = validateField(name, value);
    setErrors((prev) => ({ ...prev, ...fe }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = {
      ...validateField("NombreProveedor", form.NombreProveedor),
      ...validateField("Contacto", form.Contacto),
      ...validateField("Email", form.Email),
      ...validateField("Telefono", form.Telefono),
    };
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      if (editando) {
        await updateProveedor(editando.ProveedorID, form);
        setMensaje("Proveedor actualizado");
      } else {
        await createProveedor(form);
        setMensaje("Proveedor creado");
      }
      setTipoMensaje("success");
      setToastKey(Date.now());
      onCancel();
      await cargar();
    } catch (err) {
      setMensaje(err?.message || "Error guardando proveedor");
      setTipoMensaje("error");
      setToastKey(Date.now());
    }
  }

  function onEdit(row) {
    setEditando(row);
    setVistaActual("gestionar");
    setForm({
      NombreProveedor: row.NombreProveedor || "",
      Contacto: row.Contacto || "",
      Email: row.Email || "",
      Telefono: row.Telefono || "",
      Activo: !!row.Activo,
    });
    setErrors({});
  }

  function onCancel() {
    setEditando(null);
    setVistaActual("ver");
    setForm({
      NombreProveedor: "",
      Contacto: "",
      Email: "",
      Telefono: "",
      Activo: true,
    });
    setErrors({});
  }

  const abrirModalEliminar = (p) => {
    setProveedorSeleccionado(p);
    setShowModalEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!proveedorSeleccionado) return;
    try {
      await deleteProveedor(proveedorSeleccionado.ProveedorID);
      setMensaje("Proveedor desactivado");
      setTipoMensaje("success");
    } catch (err) {
      setMensaje(err?.message || "Error al desactivar");
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalEliminar(false);
      setProveedorSeleccionado(null);
      await cargar();
    }
  };

  const cancelarEliminar = () => {
    setShowModalEliminar(false);
    setProveedorSeleccionado(null);
  };

  function abrirModalActivar(p) {
    setProveedorPorActivar(p);
    setShowModalActivar(true);
  }

  async function confirmarActivar() {
    if (!proveedorPorActivar) return;
    try {
      await updateProveedor(proveedorPorActivar.ProveedorID, { Activo: true });
      setMensaje("Proveedor activado");
      setTipoMensaje("success");
      setToastKey(Date.now());
      await cargar();
    } catch (err) {
      setMensaje(err?.message || "Error al activar");
      setTipoMensaje("error");
      setToastKey(Date.now());
    } finally {
      setShowModalActivar(false);
      setProveedorPorActivar(null);
    }
  }

  function cancelarActivar() {
    setShowModalActivar(false);
    setProveedorPorActivar(null);
  }

  const columnas = [
    {
      name: "ID",
      selector: (r) => r.ProveedorID,
      sortable: true,
      width: "100px",
    },
    {
      name: "Nombre",
      selector: (r) => r.NombreProveedor,
      sortable: true,
      wrap: true,
      width: "300px",
    },
    {
      name: "Contacto",
      selector: (r) => r.Contacto || "",
      sortable: true,
      wrap: true,
      width: "200px",
    },
    {
      name: "Correo",
      selector: (r) => r.Email || "",
      sortable: true,
      wrap: true,
      width: "250px",
    },
    {
      name: "Teléfono",
      selector: (r) => r.Telefono || "",
      sortable: true,
      wrap: true,
      width: "150px",
    },
    {
      name: "Activo",
      selector: (r) => (r.Activo ? "Si" : "No"),
      sortable: true,
      width: "100px",
    },
    {
      name: "Acciones",
      cell: (row) => (
        <div className="table-action-group btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => onEdit(row)}
            title="Editar"
          >
            <i className="bi bi-pencil"></i>
          </button>
          {row.Activo ? (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => abrirModalEliminar(row)}
              title="Desactivar"
            >
              <i className="bi bi-trash3"></i>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => abrirModalActivar(row)}
              title="Activar"
            >
              <i className="bi bi-check-circle"></i>
            </button>
          )}
        </div>
      ),
      width: "120px",
    },
  ];

  const proveedoresFiltrados = proveedores.filter((p) =>
    Object.values(p).some((v) =>
      String(v ?? "").toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  const proveedoresTableStyles = {
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

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
  };

  return (
    <div className="container proveedores-page-container py-3">
      <div className="d-flex justify-content-end pb-2 mb-3 proveedores-menu">
        <TabBar
          tabs={proveedorTabs}
          active={vistaActual}
          onSelect={setVistaActual}
          ariaLabel="Secciones de proveedores"
        />
      </div>
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      {vistaActual === "gestionar" && (
        <div className="proveedores-card proveedores-form-container mb-3">
          <h3 className="mb-3 text-center">
            {editando ? "Editar Proveedor" : "Nuevo Proveedor"}
          </h3>
          <form onSubmit={handleSubmit} className="row g-2">
            <div className="col-12">
              <label className="form-label">
                Nombre <span className="obligatorio">*</span>
              </label>
              <input
                name="NombreProveedor"
                value={form.NombreProveedor}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${
                  errors.NombreProveedor ? "is-invalid" : ""
                }`}
                placeholder="Proveedor S.A."
              />
              {errors.NombreProveedor && (
                <div className="invalid-feedback">{errors.NombreProveedor}</div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Contacto</label>
              <input
                name="Contacto"
                value={form.Contacto}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${errors.Contacto ? "is-invalid" : ""}`}
                placeholder="Juan Perez"
              />
              {errors.Contacto && (
                <div className="invalid-feedback">{errors.Contacto}</div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Email</label>
              <input
                name="Email"
                value={form.Email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${errors.Email ? "is-invalid" : ""}`}
                placeholder="juan.perez@gmail.com"
              />
              {errors.Email && (
                <div className="invalid-feedback">{errors.Email}</div>
              )}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Telefono</label>
              <input
                name="Telefono"
                value={form.Telefono}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`form-control ${errors.Telefono ? "is-invalid" : ""}`}
                placeholder="849-555-5555"
              />
              {errors.Telefono && (
                <div className="invalid-feedback">{errors.Telefono}</div>
              )}
            </div>

            <div className="col-12 col-md-6 d-flex justify-content-center">
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
                    variant="outline-danger"
                    icon="bi bi-x-circle"
                    text="Cancelar"
                    type="button"
                    onClick={onCancel}
                  />
                )}
                <ActionButton
                  variant="primary"
                  icon={editando ? "bi bi-arrow-clockwise" : "bi bi-truck"}
                  text={editando ? "Actualizar" : "Crear"}
                  type="submit"
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {vistaActual === "ver" && (
        <div className="proveedores-card tabla-proveedores-contenedor">
          <div className="proveedores-table-panel">
            <div className="proveedores-search-wrapper mb-2">
              <input
                placeholder="Buscar proveedor..."
                className="proveedores-search-field"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <DataTable
              columns={columnas}
              data={proveedoresFiltrados}
              pagination
              highlightOnHover
              responsive
              striped
              className="table table-striped table-bordered table-hover"
              noWrap={false}
              paginationComponentOptions={paginacionOpciones}
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 20, 50]}
              conditionalRowStyles={[{ when: (row) => !row.Activo, style: { opacity: 0.5 } }]}
              noDataComponent="No se encontraron proveedores que coincidan con la busqueda"
              fixedHeader
              fixedHeaderScrollHeight="45vh"
              persistTableHead
              customStyles={proveedoresTableStyles}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showModalEliminar && !!proveedorSeleccionado}
        title="Confirmar Desactivacion"
        message={
          <>
            Desea desactivar al proveedor{" "}
            <strong>{proveedorSeleccionado?.NombreProveedor}</strong>?
          </>
        }
        onCancel={cancelarEliminar}
        onConfirm={confirmarEliminar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />

      <ConfirmModal
        isOpen={showModalActivar && !!proveedorPorActivar}
        title="Confirmar Activacion"
        message={
          <>
            Desea activar al proveedor{" "}
            <strong>{proveedorPorActivar?.NombreProveedor}</strong>?
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

export default ProveedoresPage;
