// src/components/ClientesList.js
import React from "react";

function ClientesList({ clientes, onEdit, onDelete, canEdit = true, canDelete = true }) {
  return (
    <div className="clientes-list-container table-responsive mt-4">
      <table className="table table-striped table-bordered table-hover">
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>Nombres</th>
            <th>Apellidos</th>
            <th>Tipo Documento</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Fecha Creación</th>
            <th>Fecha Modificación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.ClienteID}>
              <td>{c.ClienteID}</td>
              <td>{c.Nombres}</td>
              <td>{c.Apellidos}</td>
              <td>{c.TipoDocumento}</td>
              <td>{c.Documento}</td>
              <td>{c.Telefono || "-"}</td>
              <td>{c.Direccion || "-"}</td>
              <td>{new Date(c.FechaCreacion).toLocaleDateString()}</td>
              <td>{c.FechaModificacion ? new Date(c.FechaModificacion).toLocaleDateString() : "-"}</td>

              <td>
                {canEdit && (
                  <button
                    className="btn btn-edit btn-sm me-2"
                    onClick={() => onEdit && onEdit(c)}
                    title="Editar"
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn btn-delete btn-sm"
                    onClick={() => onDelete && onDelete(c)}
                    title="Eliminar"
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ClientesList;

