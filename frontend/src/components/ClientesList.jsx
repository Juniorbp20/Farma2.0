// src/components/ClientesList.js
import React, { useState } from "react";
import "./ClientesList.css";
import DataTable from "react-data-table-component";

function ClientesList({
  clientes,
  onEdit,
  onDelete,
  onActivate,
  canEdit = true,
  canDelete = true,
}) {
  const [busqueda, setBusqueda] = useState("");

  const columns = [
    {
      name: "ID",
      selector: (row) => row.ClienteID,
      sortable: true,
      width: "60px",
      wrap: true,
    },
    {
      name: "Nombres",
      selector: (row) => row.Nombres,
      sortable: true,
      width: "150px",
      wrap: true,
    },
    {
      name: "Apellidos",
      selector: (row) => row.Apellidos,
      sortable: true,
      width: "150px",
      wrap: true,
    },
    {
      name: "T. Documento",
      selector: (row) => row.TipoDocumento,
      sortable: true,
      width: "100px",
      wrap: true,
    },
    {
      name: "Documento",
      selector: (row) => row.Documento,
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Teléfono",
      selector: (row) => row.Telefono || "-",
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Dirección",
      selector: (row) => row.Direccion || "-",
      sortable: true,
      width: "150px",
      wrap: true,
    },
    {
      name: "Fecha Creación",
      selector: (row) => new Date(row.FechaCreacion).toLocaleDateString(),
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Fecha Modificación",
      selector: (row) =>
        row.FechaModificacion
          ? new Date(row.FechaModificacion).toLocaleDateString()
          : "-",
      sortable: true,
      width: "120px",
      wrap: true,
    },
    {
      name: "Acciones",
      cell: (row) => {
        const buttons = [];
        if (canEdit && onEdit) {
          buttons.push(
            <button
              key="edit"
              type="button"
              className="btn btn-outline-primary"
              onClick={() => onEdit(row)}
              title="Editar"
            >
              <i className="bi bi-pencil"></i>
            </button>
          );
        }
        if (row.Activo) {
          if (canDelete && onDelete) {
            buttons.push(
              <button
                key="delete"
                type="button"
                className="btn btn-outline-danger"
                onClick={() => onDelete(row)}
                title="Desactivar"
              >
                <i className="bi bi-person-dash"></i>
              </button>
            );
          }
        } else if (onActivate) {
          buttons.push(
            <button
              key="activate"
              type="button"
              className="btn btn-outline-success"
              onClick={() => onActivate(row)}
              title="Activar"
            >
              <i className="bi bi-check-circle"></i>
            </button>
          );
        }
        if (!buttons.length) return null;
        return <div className="table-action-group btn-group btn-group-sm">{buttons}</div>;
      },
      width: "120px",
    },
  ];

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
  };

  const clientesFiltrados = clientes.filter((cliente) =>
    Object.values(cliente).some((valor) =>
      String(valor ?? "").toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  const clientesTableStyles = {
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
    <div className="clientes-list-container">
      <div className="clientes-search-wrapper">
        <input
          type="text"
          className="clientes-search-field"
          placeholder="Buscar cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="clientes-table-container">
        <DataTable
          columns={columns}
          data={clientesFiltrados}
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
          noDataComponent="No se encontraron datos que coincidan con la b?squeda"
          fixedHeader
          fixedHeaderScrollHeight="45vh"
          persistTableHead
          customStyles={clientesTableStyles}
        />
      </div>
    </div>
  );
}

export default ClientesList;

