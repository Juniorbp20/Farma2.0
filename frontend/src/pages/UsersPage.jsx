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
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/recursos/Toast";
import TabBar from "../components/TabBar";
import { getUser } from "../services/authService";
import { extractErrorMessage } from "../utils/Utils";
import ActionButton from "../components/ActionButton";
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
  const [currentUser] = useState(() => getUser());
  const [vistaActual, setVistaActual] = useState("ver");
  // Estados para el modal de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  // Estados para el modal de activar
  const [showModalActivar, setShowModalActivar] = useState(false);
  const [usuarioPorActivar, setUsuarioPorActivar] = useState(null);
  const usersTabOptions = [
    { value: 'ver', label: 'Ver Usuarios', icon: 'bi bi-people' },
    { value: 'gestionar', label: 'Gestionar Usuarios', icon: 'bi bi-person-plus' },
  ];
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
  function isSelf(u) {
    if (!u) return false;
    const cu = currentUser || {};
    const sameId = cu.id != null && u.UsuarioID === cu.id;
    const sameUsername =
      (u.Username || "").toLowerCase() === (cu.username || "").toLowerCase();
    return !!(sameId || sameUsername);
  }
  function onEdit(u) {
    if (isSelf(u)) return;
    setEditando(u);
    setVistaActual("gestionar");
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
    setErrors({});
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
    setVistaActual("ver");
  }
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setForm((f) => ({ ...f, [name]: newValue }));
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
        else if (value.length > 50) newError[name] = "Maximo 50 caracteres.";
        break;
      case "Apellidos":
        if (!value.trim()) newError[name] = "El apellido es obligatorio.";
        else if (value.length > 50) newError[name] = "Maximo 50 caracteres.";
        break;
      case "Username":
        if (!value.trim()) newError[name] = "El usuario es obligatorio.";
        else if (value.length < 6) newError[name] = "Minimo 6 caracteres.";
        else if (value.length > 30) newError[name] = "Maximo 30 caracteres.";
        break;
      case "Password":
        if (!editando && !value.trim())
          newError[name] = "La contrasena es obligatoria.";
        else if (value && value.length < 4)
          newError[name] = "Minimo 4 caracteres.";
        else if (value && value.length > 30)
          newError[name] = "Maximo 30 caracteres.";
        break;
      case "Email":
        if (value && !/^\S+@\S+\.\S+$/.test(value))
          newError[name] = "Email no valido.";
        else if (value && value.length > 100)
          newError[name] = "Maximo 100 caracteres.";
        break;
      case "Telefono":
        if (value && value.length > 20)
          newError[name] = "Maximo 20 caracteres.";
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
    if (form.Username?.length < 6) newErrors.Username = "Minimo 6 caracteres.";
    if (!editando && !form.Password?.trim())
      newErrors.Password = "La contrasena es obligatoria.";
    if (!form.RolID) newErrors.RolID = "Debe seleccionar un rol.";
    if (form.Nombres?.length > 50) newErrors.Nombres = "Maximo 50 caracteres.";
    if (form.Apellidos?.length > 50)
      newErrors.Apellidos = "Maximo 50 caracteres.";
    if (form.Username?.length > 30)
      newErrors.Username = "Maximo 30 caracteres.";
    if (form.Password && form.Password.length > 30)
      newErrors.Password = "Maximo 30 caracteres.";
    if (form.Password && form.Password.length < 4)
      newErrors.Password = "Minimo 4 caracteres.";
    if (form.Email && !/^\S+@\S+\.\S+$/.test(form.Email))
      newErrors.Email = "Email no valido.";
    if (form.Email && form.Email.length > 100)
      newErrors.Email = "Maximo 100 caracteres.";
    if (form.Telefono && form.Telefono.length > 20)
      newErrors.Telefono = "Maximo 20 caracteres.";
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
          setMensaje("Usuario actualizado con exito");
          setTipoMensaje("success");
        } else {
          await createUsuario(form);
          setMensaje("Usuario creado con exito");
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
        setMensaje("Ocurrio un error: " + mensajeDeError);
        setTipoMensaje("error");
        setToastKey(Date.now());
      }
    }
  }
  const abrirModalEliminar = (u) => {
    if (isSelf(u)) return;
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
      setMensaje("Ocurrio un error: " + mensajeDeError);
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
  const abrirModalActivar = (u) => {
    if (isSelf(u)) return;
    setUsuarioPorActivar(u);
    setShowModalActivar(true);
  };
  const confirmarActivar = async () => {
    if (!usuarioPorActivar) return;
    try {
      await updateUsuario(usuarioPorActivar.UsuarioID, { Activo: true });
      setMensaje("Usuario activado");
      setTipoMensaje("success");
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      setMensaje("Ocurrio un error: " + mensajeDeError);
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalActivar(false);
      setUsuarioPorActivar(null);
      await cargar();
    }
  };
  const cancelarActivar = () => {
    setShowModalActivar(false);
    setUsuarioPorActivar(null);
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
      width: "250px",
      wrap: true,
    },
    {
      name: "Correo",
      selector: (row) => row.Email || "",
      sortable: true,
      width: "250px",
      wrap: true,
    },
    {
      name: "Teléfono",
      selector: (row) => row.Telefono || "",
      sortable: true,
      width: "150px",
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
      width: "120px",
      wrap: true,
    },
    {
      name: "Acciones",
      cell: (row) => {
        if (isSelf(row)) return null;
        const buttons = [
          <button
            key="edit"
            type="button"
            className="btn btn-outline-primary"
            onClick={() => onEdit(row)}
            title="Editar"
          >
            <i className="bi bi-pencil"></i>
          </button>,
        ];
        if (row.Activo) {
          buttons.push(
            <button
              key="delete"
              type="button"
              className="btn btn-outline-danger"
              onClick={() => abrirModalEliminar(row)}
              title="Desactivar"
            >
              <i className="bi bi-person-dash"></i>
            </button>
          );
        } else {
          buttons.push(
            <button
              key="activate"
              type="button"
              className="btn btn-outline-success"
              onClick={() => abrirModalActivar(row)}
              title="Activar"
            >
              <i className="bi bi-check-circle"></i>
            </button>
          );
        }
        return <div className="table-action-group btn-group btn-group-sm">{buttons}</div>;
      },
      width: "120px",
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
  const usuariosTableStyles = {
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
    <div className="container py-3 users-page-container">
      <div className="d-flex justify-content-end pb-2 mb-3 users-menu">
        <TabBar
          tabs={usersTabOptions}
          active={vistaActual}
          onSelect={setVistaActual}
          ariaLabel="Secciones de usuarios"
        />
      </div>
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />
      {vistaActual === "gestionar" && (
        <div className="users-card users-form-container mb-3">
          <h3 className="mb-3 text-center">
            {editando ? "Editar Usuario" : "Nuevo Usuario"}
          </h3>
          <form onSubmit={handleSubmit} className="">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">
                  Nombres <span className="obligatorio">*</span>
                </label>
                <input
                  className={`form-control ${errors.Nombres ? "is-invalid" : ""
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
                  className={`form-control ${errors.Apellidos ? "is-invalid" : ""
                    }`}
                  name="Apellidos"
                  value={form.Apellidos}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Perez"
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
                  className={`form-control ${errors.Username ? "is-invalid" : ""
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
                  Contrasena <span className="obligatorio">*</span>
                  {/* {editando ? " (vacio = no cambiar)" : " "} */}
                </label>
                <input
                  type="password"
                  className={`form-control ${errors.Password ? "is-invalid" : ""
                    }`}
                  name="Password"
                  value={form.Password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={editando ? "Vacio = no cambiar" : "********"}
                />
                {errors.Password && (
                  <div className="invalid-feedback">{errors.Password}</div>
                )}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Correo</label>
                <input
                  className={`form-control ${errors.Email ? "is-invalid" : ""
                    }`}
                  name="Email"
                  value={form.Email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="juan.perez@gmail.com"
                />
                {errors.Email && (
                  <div className="invalid-feedback">{errors.Email}</div>
                )}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Telefono</label>
                <input
                  className={`form-control ${errors.Telefono ? "is-invalid" : ""
                    }`}
                  name="Telefono"
                  value={form.Telefono}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="849-555-5555"
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
                  className={`form-select roles-select ${errors.RolID ? "is-invalid" : ""
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
                icon={editando ? "bi bi-arrow-clockwise" : "bi bi-person-plus-fill"}
                text={editando ? "Actualizar" : "Crear"}
              />
            </div>
          </form>
        </div>
      )}
      {vistaActual === "ver" && (
        <div className="users-card tabla-usuarios-cont">
          <div className="usuarios-table-panel">
            <div className="usuarios-search-wrapper mb-2">
              <input
                placeholder="Buscar..."
                className="usuarios-search-field"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
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
              conditionalRowStyles={[
                { when: (row) => !row.Activo, style: { opacity: 0.5 } },
                {
                  when: (row) =>
                    !!currentUser &&
                    (row.UsuarioID === currentUser.id ||
                      (row.Username || "").toLowerCase() ===
                      (currentUser.username || "").toLowerCase()),
                  style: { opacity: 0.5 },
                },
              ]}
              noDataComponent="No se encontraron usuarios que coincidan con la busqueda"
              fixedHeader
              fixedHeaderScrollHeight="45vh"
              persistTableHead
              customStyles={usuariosTableStyles}
            />
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={showModalEliminar && !!usuarioSeleccionado}
        title="Confirmar Desactivacion"
        message={(
          <>
            Desea desactivar al usuario{" "}
            <strong>{usuarioSeleccionado?.Username}</strong>?
          </>
        )}
        onCancel={cancelarEliminar}
        onConfirm={confirmarEliminar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />
      <ConfirmModal
        isOpen={showModalActivar && !!usuarioPorActivar}
        title="Confirmar Activacion"
        message={(
          <>
            Desea activar al usuario{" "}
            <strong>{usuarioPorActivar?.Username}</strong>?
          </>
        )}
        onCancel={cancelarActivar}
        onConfirm={confirmarActivar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />
    </div>
  );
}
export default UsersPage;
