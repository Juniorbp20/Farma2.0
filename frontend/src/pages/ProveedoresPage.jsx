/* eslint-disable default-case */
// src/pages/ProveedoresPage.js
import React, { useEffect, useState } from "react";
import "./ProveedoresPage.css";
import DataTable from "react-data-table-component";
import Toast from "../components/recursos/Toast";
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

  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    NombreProveedor: "",
    Contacto: "",
    Email: "",
    Telefono: "",
    Activo: true,
  });
  const [errors, setErrors] = useState({});

  // Estados para el modal de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  // Estados para el modal de activar
  const [showModalActivar, setShowModalActivar] = useState(false);
  const [proveedorPorActivar, setProveedorPorActivar] = useState(null);

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
        else if (value.length > 150)
          e.NombreProveedor = "Máximo 150 caracteres.";
        break;
      case "Contacto":
        if (value && value.length > 100) e.Contacto = "Máximo 100 caracteres.";
        break;
      case "Email":
        if (value && value.length > 100) e.Email = "Máximo 100 caracteres.";
        break;
      case "Telefono":
        if (value && value.length > 20) e.Telefono = "Máximo 20 caracteres.";
        break;
    }
    return e;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((f) => ({ ...f, [name]: newValue }));
    const fe = validateField(name, newValue);
    setErrors((prev) => ({ ...prev, ...fe }));
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
      setEditando(null);
      setForm({
        NombreProveedor: "",
        Contacto: "",
        Email: "",
        Telefono: "",
        Activo: true,
      });
      await cargar();
    } catch (err) {
      setMensaje(err?.message || "Error guardando proveedor");
      setTipoMensaje("error");
      setToastKey(Date.now());
    }
  }

  function onEdit(row) {
    setEditando(row);
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

  // Activación con confirmación
  function abrirModalActivar(p) {
    setProveedorPorActivar(p);
    setShowModalActivar(true);
  }

  async function confirmarActivar() {
    if (!proveedorPorActivar) return;
    try {
      await updateProveedor(proveedorPorActivar.ProveedorID, { Activo: true });
      setMensaje('Proveedor activado');
      setTipoMensaje('success');
      setToastKey(Date.now());
      await cargar();
    } catch (err) {
      setMensaje(err?.message || 'Error al activar');
      setTipoMensaje('error');
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

  async function onDelete(row) {
    if (!window.confirm(`¿Desactivar proveedor ${row.NombreProveedor}?`))
      return;
    try {
      await deleteProveedor(row.ProveedorID);
      setMensaje("Proveedor desactivado");
      setTipoMensaje("success");
      setToastKey(Date.now());
      await cargar();
    } catch (err) {
      setMensaje(err?.message || "Error al desactivar");
      setTipoMensaje("error");
      setToastKey(Date.now());
    }
  }

  const columnas = [
    {
      name: "ID",
      selector: (r) => r.ProveedorID,
      sortable: true,
      width: "80px",
    },
    {
      name: "Nombre",
      selector: (r) => r.NombreProveedor,
      sortable: true,
      wrap: true,
      width: "120px",
    },
    {
      name: "Contacto",
      selector: (r) => r.Contacto || "",
      sortable: true,
      wrap: true,
      width: "100px",
    },
    {
      name: "Correo",
      selector: (r) => r.Email || "",
      sortable: true,
      wrap: true,
      width: "100px",
    },
    {
      name: "Teléfono",
      selector: (r) => r.Telefono || "",
      sortable: true,
      wrap: true,
      width: "100px",
    },
    {
      name: "Activo",
      selector: (r) => (r.Activo ? "Sí­" : "No"),
      sortable: true,
      width: "100px",
    },
    {
      name: "Acciones",
      cell: (row) => (
        <div className="btn-accion-contenedor">
          <button
            className="btn btn-edit btn-sm me-1"
            onClick={() => onEdit(row)}
            title="Editar"
          >
            <i className="bi bi-pencil-fill"></i>
          </button>
          {row.Activo ? (
            <button
              className="btn btn-delete btn-sm"
              onClick={() => abrirModalEliminar(row)}
              title="Desactivar"
            >
              <i className="bi bi-person-dash-fill"></i>
            </button>
          ) : (
            <button
              className="btn btn-sm btn-success"
              onClick={() => abrirModalActivar(row)}
              title="Activar"
            >
              <i className="bi bi-check-circle-fill"></i>
            </button>
          )}
        </div>
      ),
      width: "100px",
    },
  ];

  const proveedoresFiltrados = proveedores.filter((p) =>
    Object.values(p).some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    )
  );

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
  };

  return (
    <div className="container py-3 users-page-container">
      <h1 className="page-title display-5 fw-bold text-center opacity-75 mb-5">
        Gestión de Proveedores
      </h1>

      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body users-form-container">
              <h5 className="card-title text-center">
                {editando ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h5>
              <form onSubmit={handleSubmit} className="">
                <div className="row g-2">
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
                      <div className="invalid-feedback">
                        {errors.NombreProveedor}
                      </div>
                    )}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Contacto</label>
                    <input
                      name="Contacto"
                      value={form.Contacto}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`form-control ${
                        errors.Contacto ? "is-invalid" : ""
                      }`}
                      placeholder="Juan Pérez"
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
                      className={`form-control ${
                        errors.Email ? "is-invalid" : ""
                      }`}
                      placeholder="juan.perez@gmail.com"
                    />
                    {errors.Email && (
                      <div className="invalid-feedback">{errors.Email}</div>
                    )}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input
                      name="Telefono"
                      value={form.Telefono}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`form-control ${
                        errors.Telefono ? "is-invalid" : ""
                      }`}
                      placeholder="849-555-5555"
                    />
                    {errors.Telefono && (
                      <div className="invalid-feedback">{errors.Telefono}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6 d-flex align-items-end  justify-content-center">
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

                  <div className="grupo-botones">
                    <button className="btn btn-submit" type="submit">
                      {editando ? "Actualizar" : "Crear"}
                    </button>
                    {editando && (
                      <button
                        className="btn btn-cancelar"
                        type="button"
                        onClick={onCancel}
                      >
                        Cancelar
                      </button>
                    )}
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
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    placeholder="Buscar..."
                    className="form-control"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
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
                noDataComponent="No se encontraron proveedores que coincidan con la búsqueda"
                customStyles={{
                  cells: {
                    style: {
                      whiteSpace: "normal !important",
                      overflow: "visible !important",
                      wordWrap: "break-word !important",
                      textOverflow: "initial !important",
                    },
                  },
                  headCells: {
                    style: {
                      whiteSpace: "normal !important",
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal eliminar */}
      {showModalEliminar && proveedorSeleccionado && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Desactivación</h3>
            <p>
              ¿Desea desactivar al proveedor <strong>{proveedorSeleccionado.NombreProveedor}</strong>?
            </p>
            <div className="modal-buttons">
              <button className="btn btn-confirm" onClick={confirmarEliminar}>
                Confirmar
              </button>
              <button className="btn btn-cancel" onClick={cancelarEliminar}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalActivar && proveedorPorActivar && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Activación</h3>
            <p>
              ¿Desea activar al proveedor <strong>{proveedorPorActivar.NombreProveedor}</strong>?
            </p>
            <div className="modal-buttons">
              <button className="btn btn-confirm" onClick={confirmarActivar}>
                Confirmar
              </button>
              <button className="btn btn-cancel" onClick={cancelarActivar}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProveedoresPage;
