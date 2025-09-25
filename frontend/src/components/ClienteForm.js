// src/components/ClienteForm.js
import React, { useState, useEffect } from "react";

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

  useEffect(() => {
    if (clienteEditando) setForm(clienteEditando);
  }, [clienteEditando]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(form);
    if (!clienteEditando) {
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
  };

  return (
    <div className="cliente-form-container">
      <form onSubmit={handleSubmit} className="form-container">
        <label>
          Nombres <span className="obligatorio">*</span>
        </label>
        <input
          name="Nombres"
          placeholder="Nombres"
          value={form.Nombres}
          onChange={handleChange}
          required
        />

        <label>
          Apellidos <span className="obligatorio">*</span>
        </label>
        <input
          name="Apellidos"
          placeholder="Apellidos"
          value={form.Apellidos}
          onChange={handleChange}
          required
        />

        <label>
          Tipo Documento <span className="obligatorio">*</span>
        </label>
        <select
          name="TipoDocumentoID"
          value={form.TipoDocumentoID}
          onChange={handleChange}
          required
        >
          {tiposDocumentos.map((t) => (
            <option key={t.TipoDocumentoID} value={t.TipoDocumentoID}>
              {t.Nombre}
            </option>
          ))}
        </select>

        <label>
          Documento <span className="obligatorio">*</span>
        </label>
        <input
          name="Documento"
          placeholder="Documento"
          value={form.Documento}
          onChange={handleChange}
          required
        />

        <label>Teléfono</label>
        <input
          name="Telefono"
          placeholder="Teléfono"
          value={form.Telefono}
          onChange={handleChange}
        />

        <label>Dirección</label>
        <input
          name="Direccion"
          placeholder="Dirección"
          value={form.Direccion}
          onChange={handleChange}
        />

        <button type="submit" className="btn btn-submit">
          {clienteEditando ? "Actualizar" : "Crear"}
        </button>
      </form>
    </div>
  );
}

export default ClienteForm;

