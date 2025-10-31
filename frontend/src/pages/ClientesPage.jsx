// src/pages/ClientesPage.js
import React, { useState, useEffect } from "react";
import "./ClientesPage.css";
import ClienteForm from "../components/ClienteForm";
import ClientesList from "../components/ClientesList";
import Toast from "../components/recursos/Toast";
import { extractErrorMessage } from '../utils/Utils'; 

import {
  getClientes,
  getTiposDocumentos,
  createCliente,
  updateCliente,
  deleteCliente,
} from "../services/clientesService";

function SectionMenu({ options = [], active, onSelect }) {
  // Opciones del menú (mostrar "Agregar" solo para admin)
  

  /* const menuOptions = [
    { key: "ver", label: "Ver Clientes", icon: "bi bi-people" },
    ...(user?.rol === "admin"
      ? [{ key: "agregar", label: "Agregar Cliente", icon: "bi bi-person-plus" }]
      : []),
  ]; */

  return (
    <div className="clientes-menu d-flex justify-content-end border-bottom pb-2 mb-3">
      <div className="btn-group" role="group" aria-label="Clientes sections">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`btn ${active === opt.key ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => onSelect(opt.key)}
          >
            {opt.icon ? <i className={`${opt.icon} me-2`} aria-hidden="true"></i> : null}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ClientesPage({ user }) {
  const [clientes, setClientes] = useState([]);
  const [tiposDocumentos, setTiposDocumentos] = useState([]);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("success");

  // Modales
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [showModalActivar, setShowModalActivar] = useState(false);

  // Vistas: 'agregar', 'ver' (por defecto 'ver')
  const [vistaActual, setVistaActual] = useState("ver");

  // Para la notificacion
  const [toastKey, setToastKey] = useState(Date.now());

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setClientes(await getClientes());
    setTiposDocumentos(await getTiposDocumentos());
  };

  const handleSubmit = async (cliente) => {
    try {
      if (clienteEditando) {
        await updateCliente(clienteEditando.ClienteID, cliente);
        setClienteEditando(null);
        setShowModalEditar(false);
        setMensaje("Cliente actualizado con éxito.");
      } else {
        await createCliente(cliente);
        setMensaje("Cliente creado con éxito.");
      }
      setTipoMensaje("success");
      await cargarDatos();
      setToastKey(Date.now());
      return true;
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      // const mensajeDeError = err.response?.data?.message || err.message;
      setMensaje("Ocurrió un error: " + mensajeDeError);
      setTipoMensaje("error");
      setToastKey(Date.now());
      return false;
    }
  };

  const handleEdit = (cliente) => {
    setClienteEditando(cliente);
    setShowModalEditar(true);
  };
  
  const abrirModalEliminar = (cliente) => {
    setClienteSeleccionado(cliente);
    setShowModalEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!clienteSeleccionado) return;
    try {
      await deleteCliente(clienteSeleccionado.ClienteID);
      setMensaje("Cliente eliminado con éxito.");
      setTipoMensaje("success");
      await cargarDatos();
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      // const mensajeDeError = err.response?.data?.message || err.message;
      setMensaje("Ocurrió un error: " + mensajeDeError);
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalEliminar(false);
      setClienteSeleccionado(null);
    }
  };

  const cancelarEliminar = () => {
    setShowModalEliminar(false);
    setClienteSeleccionado(null);
  };
  const cancelarEdicion = () => {
    setShowModalEditar(false);
    setClienteEditando(null);
  };
  const abrirModalActivar = (cliente) => { setClienteSeleccionado(cliente); setShowModalActivar(true); };

  const menuOptions = [
    { key: "ver", label: "Ver Clientes", icon: "bi bi-people" },
    ...(user?.rol === "admin" ? [{ key: "agregar", label: "Agregar Cliente", icon: "bi bi-person-plus" }] : []),
  ];

  return (
    <div className="clientes-page-container container py-3">
      <SectionMenu options={menuOptions} active={vistaActual} onSelect={setVistaActual} />

      <div className="mb-3">
        {vistaActual === "inicio" && (
          <h1 className="page-title display-5 fw-bold text-uppercase text-center opacity-75">
            Gestión de Clientes
          </h1>
        )}
        {vistaActual === "agregar" && (
          <h1 className="page-title display-5 fw-bold text-center opacity-75">
            Agregar cliente:
          </h1>
        )}
        {vistaActual === "ver" && (
          <h1 className="page-title display-5 fw-bold text-center opacity-75">
            Lista de clientes:
          </h1>
        )}
      </div>

      {/*Notificaciones de errores o cambios*/}
      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      {vistaActual === "inicio" && (
        <div className="tarjetas-container">
          {user?.rol === "admin" && (
            <div className="tarjeta" onClick={() => setVistaActual("agregar")}>
              <i className="bi bi-person-plus"></i>
              <h2>Agregar Cliente</h2>
              <p>Añade un nuevo cliente al sistema.</p>
            </div>
          )}
          <div className="tarjeta" onClick={() => setVistaActual("ver")}>
            <i className="bi bi-people"></i>
            <h2>Ver Clientes</h2>
            <p>Ver, editar y eliminar los clientes existentes.</p>
          </div>
        </div>
      )}

      {vistaActual === "agregar" && (
        <>
          
          <div className="clientes-form-wrapper">
            <h2 className="form-title">
              {clienteEditando ? "Editar cliente:" : ""}
            </h2>
            <ClienteForm
              onSubmit={handleSubmit}
              clienteEditando={clienteEditando}
              tiposDocumentos={tiposDocumentos}
            />
          </div>
        </>
      )}

      {vistaActual === "ver" && (
        <>
          
          <div className="clientes-list-wrapper">
            <ClientesList
              clientes={clientes}
              onEdit={user?.rol === "admin" ? handleEdit : undefined}
              onDelete={user?.rol === "admin" ? abrirModalEliminar : undefined}
              onActivate={user?.rol === "admin" ? abrirModalActivar : undefined}
              canEdit={user?.rol === "admin"}
              canDelete={user?.rol === "admin"}
            />
          </div>
        </>
      )}

      {/* Modal eliminar */}
      {showModalEliminar && clienteSeleccionado && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Borrado</h3>
            <p>
              ¿Desea borrar al cliente{" "}
              <strong>
                {clienteSeleccionado.Nombres} {clienteSeleccionado.Apellidos}
              </strong>
              ?
            </p>
            <p>
              Documento: <b>[{clienteSeleccionado.TipoDocumento}]</b>{" "}
              {clienteSeleccionado.Documento}
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

      {/* Modal editar */}
      {showModalEditar && clienteEditando && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="d-flex">
              <button className="btn-modal" onClick={cancelarEdicion}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <ClienteForm
              onSubmit={handleSubmit}
              clienteEditando={clienteEditando}
              tiposDocumentos={tiposDocumentos}
            />
          </div>
        </div>
      )}
    
      {showModalActivar && clienteSeleccionado && (
        <div className="modal-overlay modal-delete">
          <div className="modal-content modal-delete-content">
            <h3>Confirmar Activación</h3>
            <p>
              ¿Desea activar al cliente <strong> {clienteSeleccionado.Nombres} {clienteSeleccionado.Apellidos}c</strong>?
            </p>
            <div className="modal-buttons">
              <button className="btn btn-confirm" onClick={async ()=>{ try { await updateCliente(clienteSeleccionado.ClienteID, { Activo: true }); setMensaje("Cliente activado"); setTipoMensaje("success"); await cargarDatos(); } catch(e){ setMensaje("Error al activar: " + (e?.message||'')); setTipoMensaje("error"); } finally { setToastKey(Date.now()); setShowModalActivar(false); setClienteSeleccionado(null);} }}>
                Confirmar
              </button>
              <button className="btn btn-cancel" onClick={()=>{ setShowModalActivar(false); setClienteSeleccionado(null); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientesPage;










