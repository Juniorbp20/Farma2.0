// src/components/AyudaModal.jsx
import React from "react";
import "./AyudaModal.css";

const AyudaModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="ayuda-modal-overlay" onClick={onClose}>
      <div className="ayuda-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ayuda-modal-header">
          <h3>Uso de FMANAGER</h3>
          <button className="ayuda-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="ayuda-placeholder">
          <div className="ayuda-icon">
            <i className="bi bi-mortarboard"></i>
          </div>
          <h4 className="ayuda-title">Tutoriales Próximamente</h4>
          <p className="ayuda-description">
            Estamos preparando videos tutoriales, guías necesarias y otros recursos 
            de soporte para la completa comprensión y manipulación del sistema.
          </p>
          <div className="ayuda-subtext">
            <i className="bi bi-clock-history"></i>
            Próximamente disponible
          </div>
        </div>
      </div>
    </div>
  );
};

export default AyudaModal;
