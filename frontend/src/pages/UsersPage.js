/* eslint-disable default-case */
// src/pages/UsersPage.js
import React, { useEffect, useState } from "react";
import "./UsersPage.css";
import {
  getUsuarios,
  getRoles,
  createUsuario,
  updateUsuario,
  deleteUsuario,
} from "../services/usersService";
import DataTable from "react-data-table-component";
import Toast from "../components/recursos/Toast";
import { extractErrorMessage } from "../utils/Utils";

function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    Nombres: "",
    Apellidos: "",
    Username: "",
    Password: "",
    Email: "",
    Telefono: "",
    RolID: "",
    Activo: true,
  });
  const [errors, setErrors] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [toastKey, setToastKey] = useState(Date.now());

  // Estados para el modal de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  useEffect(() => {
    cargar();
  }, []);
  useEffect(() => {
    if (mensaje) {
      setToastKey(Date.now());
    }
  }, [mensaje]);

  async function cargar() {
    const [u, r] = await Promise.all([getUsuarios(), getRoles()]);
    setUsuarios(u);
    setRoles(r);
  }

  function onEdit(u) {
    setEditando(u);
    setForm({
      Nombres: u.Nombres || "",
      Apellidos: u.Apellidos || "",
      Username: u.Username || "",
      Password: "",
      Email: u.Email || "",
      Telefono: u.Telefono || "",
      RolID: String(u.RolID || ""),
      Activo: !!u.Activo,
    });
    setErrors({}); // Limpiar errores al editar
  }

  function onCancel() {
    setEditando(null);
    setForm({
      Nombres: "",
      Apellidos: "",
      Username: "",
      Password: "",
      Email: "",
      Telefono: "",
      RolID: "",
      Activo: true,
    });
    setErrors({});
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((f) => ({ ...f, [name]: newValue }));

    // Validar campo individual
    const fieldError = validateField(name, newValue);
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (fieldError[name]) {
        newErrors[name] = fieldError[name];
      } else {
        delete newErrors[name];
      }
      return newErrors;
    });
  }

  function handleBlur(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    const fieldError = validateField(name, newValue);
    setErrors((prev) => ({ ...prev, ...fieldError }));
  }

  const validateField = (name, value) => {
    const newError = {};

    switch (name) {
      case "Nombres":
        if (!value.trim()) newError[name] = "El nombre es obligatorio.";
        else if (value.length > 50) newError[name] = "Máximo 50 caracteres.";
        break;

      case "Apellidos":
        if (!value.trim()) newError[name] = "El apellido es obligatorio.";
        else if (value.length > 50) newError[name] = "Máximo 50 caracteres.";
        break;

      case "Username":
        if (!value.trim()) newError[name] = "El usuario es obligatorio.";
        else if (value.length < 6) newError[name] = "Mínimo 6 caracteres.";
        else if (value.length > 30) newError[name] = "Máximo 30 caracteres.";
        break;

      case "Password":
        if (!editando && !value.trim())
          newError[name] = "La contraseña es obligatoria.";
        else if (value && value.length < 4)
          newError[name] = "Mínimo 4 caracteres.";
        else if (value && value.length > 30)
          newError[name] = "Máximo 30 caracteres.";
        break;

      case "Email":
        if (value && !/^\S+@\S+\.\S+$/.test(value))
          newError[name] = "Email no válido.";
        else if (value && value.length > 100)
          newError[name] = "Máximo 100 caracteres.";
        break;

      case "Telefono":
        if (value && value.length > 20)
          newError[name] = "Máximo 20 caracteres.";
        break;

      case "RolID":
        if (!value) newError[name] = "Debe seleccionar un rol.";
        break;
    }

    return newError;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.Nombres?.trim()) newErrors.Nombres = "El nombre es obligatorio.";
    if (!form.Apellidos?.trim())
      newErrors.Apellidos = "El apellido es obligatorio.";
    if (!form.Username?.trim())
      newErrors.Username = "El usuario es obligatorio.";
    if (form.Username?.length < 6) newErrors.Username = "Mínimo 6 caracteres.";
    if (!editando && !form.Password?.trim())
      newErrors.Password = "La contraseña es obligatoria.";
    if (!form.RolID) newErrors.RolID = "Debe seleccionar un rol.";

    if (form.Nombres?.length > 50) newErrors.Nombres = "Máximo 50 caracteres.";
    if (form.Apellidos?.length > 50)
      newErrors.Apellidos = "Máximo 50 caracteres.";
    if (form.Username?.length > 30)
      newErrors.Username = "Máximo 30 caracteres.";
    if (form.Password && form.Password.length > 30)
      newErrors.Password = "Máximo 30 caracteres.";
    if (form.Password && form.Password.length < 4)
      newErrors.Password = "Mínimo 4 caracteres.";
    if (form.Email && !/^\S+@\S+\.\S+$/.test(form.Email))
      newErrors.Email = "Email no válido.";
    if (form.Email && form.Email.length > 100)
      newErrors.Email = "Máximo 100 caracteres.";
    if (form.Telefono && form.Telefono.length > 20)
      newErrors.Telefono = "Máximo 20 caracteres.";

    return newErrors;
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        if (editando) {
          const payload = { ...form };
          if (!payload.Password) delete payload.Password;
          await updateUsuario(editando.UsuarioID, payload);
          setMensaje("Usuario actualizado con éxito");
          setTipoMensaje("success");
        } else {
          await createUsuario(form);
          setMensaje("Usuario creado con éxito");
          setTipoMensaje("success");
          setForm({
            Nombres: "",
            Apellidos: "",
            Username: "",
            Password: "",
            Email: "",
            Telefono: "",
            RolID: "",
            Activo: true,
          });
        }
        setToastKey(Date.now());
        onCancel();
        await cargar();
      } catch (err) {
        const mensajeDeError = extractErrorMessage(err);
        // const mensajeDeError = err.response?.data?.message || err.message;
        setMensaje("Ocurrió un error: " + mensajeDeError);
        setTipoMensaje("error");
        setToastKey(Date.now());
      }
    }
  }

  const abrirModalEliminar = (u) => {
    setUsuarioSeleccionado(u);
    setShowModalEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!usuarioSeleccionado) return;
    try {
      await deleteUsuario(usuarioSeleccionado.UsuarioID);
      setMensaje("Usuario desactivado");
      setTipoMensaje("success");
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      // const mensajeDeError = err.response?.data?.message || err.message;
      setMensaje("Ocurrió un error: " + mensajeDeError);
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalEliminar(false);
      setUsuarioSeleccionado(null);
      await cargar();
    }
  };

  const cancelarEliminar = () => {
    setShowModalEliminar(false);
    setUsuarioSeleccionado(null);
  };

  const columns = [
    {
      name: "ID",
      selector: (row) => row.UsuarioID,
      sortable: true,
      width: "80px",
      wrap: true,
    },
    {
      name: "Usuario",
      selector: (row) => row.Username,
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Nombre",
      selector: (row) => `${row.Nombres || ""} ${row.Apellidos || ""}`,
      sortable: true,
      width: "170px",
      wrap: true,
    },
    {
      name: "Rol",
      selector: (row) => row.NombreRol || row.RolID,
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Activo",
      selector: (row) => (row.Activo ? "Sí" : "No"),
      sortable: true,
      width: "100px",
      wrap: true,
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
          <button
            className="btn btn-delete btn-sm"
            onClick={() => abrirModalEliminar(row)}
            title="Desactivar"
          >
            <i className="bi bi-person-dash-fill"></i>
          </button>
        </div>
      ),
      width: "100px",
    },
  ];

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    Object.values(u).some((val) =>
      String(val).toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  return (
    <div className="container py-3 users-page-container">
      <h1 className="page-title display-5 fw-bold text-uppercase text-center opacity-75 mb-5">
        Gestión de Usuarios
      </h1>

      {/* Toast para notificaciones */}
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body users-form-container">
              <h5 className="card-title text-center">
                {editando ? "Editar Usuario" : "Nuevo Usuario"}
              </h5>
              <form onSubmit={handleSubmit} className="">
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Nombres <span className="obligatorio">*</span>
                    </label>
                    <input
                      className={`form-control ${
                        errors.Nombres ? "is-invalid" : ""
                      }`}
                      name="Nombres"
                      value={form.Nombres}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Juan"
                    />
                    {errors.Nombres && (
                      <div className="invalid-feedback">{errors.Nombres}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Apellidos <span className="obligatorio">*</span>
                    </label>
                    <input
                      className={`form-control ${
                        errors.Apellidos ? "is-invalid" : ""
                      }`}
                      name="Apellidos"
                      value={form.Apellidos}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Pérez"
                    />
                    {errors.Apellidos && (
                      <div className="invalid-feedback">{errors.Apellidos}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Usuario <span className="obligatorio">*</span>
                    </label>
                    <input
                      className={`form-control ${
                        errors.Username ? "is-invalid" : ""
                      }`}
                      name="Username"
                      value={form.Username}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="juanperez"
                    />
                    {errors.Username && (
                      <div className="invalid-feedback">{errors.Username}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Contraseña <span className="obligatorio">*</span>
                      {/* {editando ? " (vacío = no cambiar)" : " "} */}
                    </label>
                    <input
                      type="password"
                      className={`form-control ${
                        errors.Password ? "is-invalid" : ""
                      }`}
                      name="Password"
                      value={form.Password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder={editando ? "Vacío = no cambiar" : "••••••••"}
                    />
                    {errors.Password && (
                      <div className="invalid-feedback">{errors.Password}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Correo</label>
                    <input
                      className={`form-control ${
                        errors.Email ? "is-invalid" : ""
                      }`}
                      name="Email"
                      value={form.Email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Correo"
                    />
                    {errors.Email && (
                      <div className="invalid-feedback">{errors.Email}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input
                      className={`form-control ${
                        errors.Telefono ? "is-invalid" : ""
                      }`}
                      name="Telefono"
                      value={form.Telefono}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Teléfono"
                    />
                    {errors.Telefono && (
                      <div className="invalid-feedback">{errors.Telefono}</div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">
                      Rol <span className="obligatorio">*</span>
                    </label>
                    <select
                      className={`form-select ${
                        errors.RolID ? "is-invalid" : ""
                      }`}
                      name="RolID"
                      value={form.RolID}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <option value="">Seleccione</option>
                      {roles.map((r) => (
                        <option key={r.RolID} value={r.RolID}>
                          {r.NombreRol}
                        </option>
                      ))}
                    </select>
                    {errors.RolID && (
                      <div className="invalid-feedback">{errors.RolID}</div>
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
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          {/* Input de búsqueda */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#FFFFFF",
              justifyContent: "flex-end",
              marginBottom: "10px",
            }}
          >
            <input
              type="text"
              className="form-control"
              placeholder="Buscar en toda la tabla..."
              value={busqueda}
              style={{
                width: "300px",
                outline: "none",
                boxShadow: "none",
              }}
              onFocus={(e) => (e.target.style.boxShadow = "none")}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {/* Tabla de usuarios */}
          <div className="tabla-usuarios-contenedor">
            <DataTable
              columns={columns}
              data={usuariosFiltrados}
              pagination
              highlightOnHover
              responsive
              striped
              className="table table-striped table-bordered table-hover"
              noWrap={false}
              paginationComponentOptions={paginacionOpciones}
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 20, 50]}
              noDataComponent="No se encontraron usuarios que coincidan con la búsqueda"
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

      {/* Modal eliminar */}
      {showModalEliminar && usuarioSeleccionado && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Desactivación</h3>
            <p>
              ¿Desea desactivar al usuario{" "}
              <strong>{usuarioSeleccionado.Username}</strong>?
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
    </div>
  );
}

export default UsersPage;
