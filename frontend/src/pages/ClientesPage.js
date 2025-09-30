// src/pages/ClientesPage.js
import React, { useState, useEffect } from "react";
import "./ClientesPage.css";
import ClienteForm from "../components/ClienteForm";
import ClientesList from "../components/ClientesList";
import CustomButton from "../components/recursos/CustomButton";
import Toast from "../components/recursos/Toast";
import { extractErrorMessage } from '../utils/Utils'; 

import {
  getClientes,
  getTiposDocumentos,
  createCliente,
  updateCliente,
  deleteCliente,
} from "../services/clientesService";

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

  // Vistas: 'inicio', 'agregar', 'ver'
  const [vistaActual, setVistaActual] = useState("inicio");

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
  const handleVolver = () => {
    setVistaActual("inicio");
    setMensaje("");
    setClienteEditando(null);
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

  return (
    <div className="clientes-page-container container py-3">
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
          <CustomButton onClick={handleVolver} />
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
          <CustomButton onClick={handleVolver} />
          <div className="clientes-list-wrapper">
            <ClientesList
              clientes={clientes}
              onEdit={user?.rol === "admin" ? handleEdit : undefined}
              onDelete={user?.rol === "admin" ? abrirModalEliminar : undefined}
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
    </div>
  );
}

export default ClientesPage;