// src/pages/ClientesPage.jsx
import React, { useState, useEffect } from "react";
import "./ClientesPage.css";
import ConfirmModal from "../components/ConfirmModal";
import ClienteForm from "../components/ClienteForm";
import ClientesList from "../components/ClientesList";
import Toast from "../components/recursos/Toast";
import TabBar from "../components/TabBar";
import { extractErrorMessage } from "../utils/Utils";
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

  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [showModalActivar, setShowModalActivar] = useState(false);

  const [vistaActual, setVistaActual] = useState("ver"); // 'ver' | 'agregar'
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
        setMensaje("Cliente actualizado con exito.");
      } else {
        await createCliente(cliente);
        setMensaje("Cliente creado con exito.");
      }
      setTipoMensaje("success");
      await cargarDatos();
      setToastKey(Date.now());
      return true;
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      setMensaje("Ocurrio un error: " + mensajeDeError);
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
      setMensaje("Cliente eliminado con exito.");
      setTipoMensaje("success");
      await cargarDatos();
    } catch (err) {
      const mensajeDeError = extractErrorMessage(err);
      setMensaje("Ocurrio un error: " + mensajeDeError);
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

  const abrirModalActivar = (cliente) => {
    setClienteSeleccionado(cliente);
    setShowModalActivar(true);
  };

  const confirmarActivar = async () => {
    if (!clienteSeleccionado) return;
    try {
      await updateCliente(clienteSeleccionado.ClienteID, { Activo: true });
      setMensaje("Cliente activado");
      setTipoMensaje("success");
      await cargarDatos();
    } catch (e) {
      setMensaje("Error al activar: " + (e?.message || ""));
      setTipoMensaje("error");
    } finally {
      setToastKey(Date.now());
      setShowModalActivar(false);
      setClienteSeleccionado(null);
    }
  };

  const cancelarActivar = () => {
    setShowModalActivar(false);
    setClienteSeleccionado(null);
  };

  const menuOptions = [
    { value: "ver", label: "Ver Clientes", icon: "bi bi-people" },
    ...(user?.rol === "admin"
      ? [{ value: "agregar", label: "Agregar Cliente", icon: "bi bi-person-plus" }]
      : []),
  ];

  return (
    <div className="clientes-page-container container py-3">
      <div className="clientes-menu d-flex justify-content-end pb-2 mb-3">
        <TabBar
          tabs={menuOptions}
          active={vistaActual}
          onSelect={setVistaActual}
          ariaLabel="Secciones de clientes"
        />
      </div>

      <Toast key={toastKey} message={mensaje} type={tipoMensaje} />

      {vistaActual === "agregar" && (
        <div className="clientes-form-wrapper">
          <ClienteForm
            onSubmit={handleSubmit}
            clienteEditando={clienteEditando}
            tiposDocumentos={tiposDocumentos}
          />
        </div>
      )}

      {vistaActual === "ver" && (
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
      )}

      <ConfirmModal
        isOpen={showModalEliminar && !!clienteSeleccionado}
        title="Confirmar Borrado"
        message={
          <>
            Desea borrar al cliente{" "}
            <strong>
              {clienteSeleccionado?.Nombres} {clienteSeleccionado?.Apellidos}
            </strong>
            ?
            <br />
            Documento: <strong>[{clienteSeleccionado?.TipoDocumento}]</strong>{" "}
            {clienteSeleccionado?.Documento}
          </>
        }
        onCancel={cancelarEliminar}
        onConfirm={confirmarEliminar}
        cancelText="Cancelar"
        confirmText="Confirmar"
      />

      {showModalEditar && clienteEditando && (
        <div className="clientes-modal-backdrop" onClick={cancelarEdicion}>
          <div className="clientes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clientes-modal-header">
              <div className="clientes-modal-title-badge">
                <i className="bi bi-person-lines-fill"></i>
                <span>Editar cliente</span>
              </div>
              <button className="btn-close" type="button" onClick={cancelarEdicion} aria-label="Cerrar">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="clientes-modal-body">
              <ClienteForm
                onSubmit={handleSubmit}
                clienteEditando={clienteEditando}
                tiposDocumentos={tiposDocumentos}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showModalActivar && !!clienteSeleccionado}
        title="Confirmar Activacion"
        message={
          <>
            Desea activar al cliente{" "}
            <strong>
              {clienteSeleccionado?.Nombres} {clienteSeleccionado?.Apellidos}
            </strong>
            ?
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

export default ClientesPage;
