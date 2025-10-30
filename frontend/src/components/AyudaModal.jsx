// src/components/AyudaModal.jsx
import React from "react";
import "./AyudaModal.css";
import AyudaPage from "../pages/AyudaPage";

const AyudaModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="ayuda-modal-overlay" onClick={onClose}>
      <div className="ayuda-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ayuda-modal-header">
          <h3>Tutoriales y Soporte</h3>
          <button className="ayuda-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="ayuda-modal-body">
          <AyudaPage />
        </div>
      </div>
    </div>
  );
};

export default AyudaModal;
