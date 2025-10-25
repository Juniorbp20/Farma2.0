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
      width: "80px",
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
      name: "Tipo Documento",
      selector: (row) => row.TipoDocumento,
      sortable: true,
      width: "150px",
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
      cell: (row) => (
        <div className="btn-accion-contenedor">
          {canEdit && (
            <button
              className="btn btn-edit btn-sm me-1"
              onClick={() => onEdit && onEdit(row)}
              title="Editar"
            >
              <i className="bi bi-pencil-fill"></i>
            </button>
          )}
          {row.Activo ? (
            canDelete && (
              <button
                className="btn btn-delete btn-sm"
                onClick={() => onDelete && onDelete(row)}
                title="Desactivar"
              >
                <i className="bi bi-person-dash-fill"></i>
              </button>
            )
          ) : (
            <button
              className="btn btn-sm btn-success"
              onClick={() => onActivate && onActivate(row)}
              title="Activar"
            >
              <i className="bi bi-check-circle-fill"></i>
            </button>
          )}
        </div>
      ),
      width: "120px",
    },
  ];

  const paginacionOpciones = {
    rowsPerPageText: "Filas:",
    rangeSeparatorText: "de",
    // selectAllRowsItem: true,
    // selectAllRowsItemText: "Todo",
  };

  // Filtrar clientes según búsqueda
  const clientesFiltrados = clientes.filter((cliente) =>
    Object.values(cliente).some((valor) =>
      String(valor).toLowerCase().includes(busqueda.toLowerCase())
    )
  );

  return (
    <div className="clientes-list-container">
      {/* Input de búsqueda */}
      <div style={{ display: "flex", backgroundColor: "#FFFFFF", justifyContent: "flex-end"}}>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar en toda la tabla..."
          value={busqueda}
          style={{
            width: "400px",
            outline: "none",
            boxShadow: "none",
          }}
          onFocus={(e) => (e.target.style.boxShadow = "none")}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="table-container">
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
        noDataComponent="No se encontraron datos que coincidan con la búsqueda"
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
  );
}

export default ClientesList;

