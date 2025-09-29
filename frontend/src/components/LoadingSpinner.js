// src/components/LoadingSpinner.js
import React from 'react';

function LoadingSpinner({ message = "Cargando..." }) {
  return (
    <div className="d-flex justify-content-center align-items-center py-4">
      <div className="spinner-border text-primary me-2" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <span className="text-muted">{message}</span>
    </div>
  );
}

export default LoadingSpinner;