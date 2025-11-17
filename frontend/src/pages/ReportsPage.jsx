import React from 'react';
import './ReportsPage.css';

export default function ReportsPage() {
  return (
    <div className="container reports-page-container py-4 d-flex flex-column align-items-center">
      <h1 className="page-title display-5 fw-bold text-center opacity-75 mb-4">Reportes</h1>
      <div className="reports-placeholder card placeholder-card">
        <div className="card-body d-flex flex-column justify-content-center align-items-center text-center">
          <div className="placeholder-icon mb-3">
            <i className="bi bi-graph-up" />
          </div>
          <h4 className="fw-bold mb-2">En construcción</h4>
          <p className="text-muted mb-0">
            Pronto podrás consultar reportes de ventas, inventario, vencimientos y más.
          </p>
        </div>
      </div>
    </div>
  );
}
