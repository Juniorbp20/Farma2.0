/* eslint-disable default-case */
// src/components/ClienteForm.js
import React, { useState, useEffect } from "react";
import "./ClienteForm.css";

function ClienteForm({ onSubmit, clienteEditando, tiposDocumentos }) {
  const [form, setForm] = useState({
    Nombres: "",
    Apellidos: "",
    TipoDocumentoID: "1",
    Documento: "",
    Telefono: "",
    Direccion: "",
    Activo: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (clienteEditando) setForm(clienteEditando);
  }, [clienteEditando]);

  const handleChange = (e) => {
  const { name, value } = e.target;
  setForm({ ...form, [name]: value });

  const fieldError = validateField(name, value);
  
  setErrors(prev => {
    const newErrors = { ...prev };
    
    if (fieldError[name]) {
      newErrors[name] = fieldError[name];
    } else {
      delete newErrors[name];
    }
    
    return newErrors;
  });
};

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const fieldError = validateField(name, value);
    setErrors(prev => ({ ...prev, ...fieldError }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.Nombres?.trim()) newErrors.Nombres = "El nombre es obligatorio.";
    if (!form.Apellidos?.trim())
      newErrors.Apellidos = "El apellido es obligatorio.";
    if (!form.Documento?.trim())
      newErrors.Documento = "El documento es obligatorio.";

    if ((form.Nombres || "").length > 50)
      newErrors.Nombres = "El nombre no puede exceder los 50 caracteres.";
    if ((form.Apellidos || "").length > 50)
      newErrors.Apellidos = "El apellido no puede exceder los 50 caracteres.";
    if ((form.Documento || "").length > 20)
      newErrors.Documento = "El documento no puede exceder los 20 caracteres.";
    if ((form.Telefono || "").length > 20)
      newErrors.Telefono = "El teléfono no puede exceder los 20 caracteres.";
    if ((form.Direccion || "").length > 400)
      newErrors.Direccion = "No puede exceder los 400 caracteres.";

    return newErrors;
  };

  const validateField = (name, value) => {
    const newError = {};

    switch (name) {
      case "Nombres":
        if (!value.trim()) newError[name] = "El nombre es obligatorio.";
        else if (value.length > 50) newError[name] = "Máximo 50 caracteres.";
        break;

      case "Apellidos":
        if (!value.trim()) newError[name] = "El apellido es obligatorio.";
        else if (value.length > 50) newError[name] = "Máximo 50 caracteres.";
        break;

      case "Documento":
        if (!value.trim()) newError[name] = "El documento es obligatorio.";
        else if (value.length > 20) newError[name] = "Máximo 20 caracteres.";
        break;

      case "Telefono":
        if (value && value.length > 20)
          newError[name] = "Máximo 20 caracteres.";
        break;

      case "Direccion":
        if (value && value.length > 400)
          newError[name] = "Máximo 400 caracteres.";
        break;
    }

    return newError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validateForm();
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      const isSuccess = await onSubmit(form);
      
      if (isSuccess && !clienteEditando) {
        setForm({
          Nombres: "",
          Apellidos: "",
          TipoDocumentoID: "1",
          Documento: "",
          Telefono: "",
          Direccion: "",
          Activo: true,
        });
      }
    }
  };

  return (
    <div className="cliente-form-container">
    <form onSubmit={handleSubmit} className="form-container">
      <div className="row mb-2">
        <div className="col-md-6">
          <label className="form-label">
            Nombres <span className="obligatorio">*</span>
          </label>
          <input
            name="Nombres"
            placeholder="Juan"
            value={form.Nombres}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`form-control ${errors.Nombres ? 'is-invalid' : ''}`}
          />
          {errors.Nombres && <div className="invalid-feedback">{errors.Nombres}</div>}
        </div>
        
        <div className="col-md-6">
          <label className="form-label">
            Apellidos <span className="obligatorio">*</span>
          </label>
          <input
            name="Apellidos"
            placeholder="Pérez"
            value={form.Apellidos}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`form-control ${errors.Apellidos ? 'is-invalid' : ''}`}
          />
          {errors.Apellidos && <div className="invalid-feedback">{errors.Apellidos}</div>}
        </div>
      </div>

      <div className="row mb-2">
        <div className="col-md-3">
          <label className="form-label">
            Tipo Documento <span className="obligatorio">*</span>
          </label>
          <select
            name="TipoDocumentoID"
            value={form.TipoDocumentoID}
            onChange={handleChange}
            style={{ width: '75%' }}
            className="form-select"
          >
            {tiposDocumentos?.length > 0 ? (
              tiposDocumentos.map((t) => (
                <option key={t.TipoDocumentoID} value={t.TipoDocumentoID}>
                  {t.Nombre}
                </option>
              ))
            ) : (
              <option value="">Cargando...</option>
            )}
          </select>
        </div>
        
        <div className="col-md-5">
          <label className="form-label">
            Documento <span className="obligatorio">*</span>
          </label>
          <input
            name="Documento"
            placeholder="XXXXXXXXXXX"
            value={form.Documento}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`form-control ${errors.Documento ? 'is-invalid' : ''}`}
          />
          {errors.Documento && <div className="invalid-feedback">{errors.Documento}</div>}
        </div>
        
        <div className="col-md-4">
          <label className="form-label">Teléfono</label>
          <input
            name="Telefono"
            placeholder="849-555-5555"
            value={form.Telefono}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`form-control ${errors.Telefono ? 'is-invalid' : ''}`}
          />
          {errors.Telefono && <div className="invalid-feedback">{errors.Telefono}</div>}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">Datos del cliente</label>
        <textarea
          name="Direccion"
          placeholder="Está ubicado en..."
          value={form.Direccion}
          onChange={handleChange}
          onBlur={handleBlur}
          rows="2"
          className={`form-control ${errors.Direccion ? 'is-invalid' : ''}`}
        />
        {errors.Direccion && <div className="invalid-feedback">{errors.Direccion}</div>}
      </div>

      <button type="submit" className="btn btn-submit">
        {clienteEditando ? "Actualizar" : "Crear"}
      </button>
    </form>
  </div>
  );
}

export default ClienteForm;