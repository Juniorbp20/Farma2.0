import React, { useEffect, useState } from "react";
import "./ConfigModal.css";
import {
  getParametrosSistema,
  updateParametrosSistema,
} from "../services/configService";
import { resolveLogoSrc } from "../utils/logo";

const initialForm = {
  nombreEmpresa: "",
  rucNit: "",
  direccion: "",
  monedaSimbolo: "RD$",
  monedaNombre: "",
  telefonoSoporte: "",
  emailSoporte: "",
  logoPath: "",
};

const normalizeData = (data = {}) => ({
  nombreEmpresa: (data.nombreEmpresa || "").trim(),
  rucNit: (data.rucNit || "").trim(),
  direccion: (data.direccion || "").trim(),
  monedaSimbolo: (data.monedaSimbolo || "RD$").trim(),
  monedaNombre: (data.monedaNombre || "").trim(),
  telefonoSoporte: (data.telefonoSoporte || "").trim(),
  emailSoporte: (data.emailSoporte || "").trim(),
  logoPath: (data.logoPath || "").trim(),
});

const ConfigModal = ({ isOpen, onClose, user, onUpdated }) => {
  const [form, setForm] = useState(initialForm);
  const [originalData, setOriginalData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const isAdmin = user?.rol === "admin" || String(user?.rolId) === "1";

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
      setOriginalData(initialForm);
      setError("");
      setHasChanges(false);
      return;
    }
    let isMounted = true;
    setLoading(true);
    setError("");
    getParametrosSistema()
      .then((data) => {
        if (!isMounted) return;
        const normalized = normalizeData(data);
        setForm({ ...normalized });
        setOriginalData({ ...normalized });
        setHasChanges(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "No se pudo cargar la configuración.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const current = normalizeData(form || initialForm);
    const original = normalizeData(originalData || initialForm);
    const dirty = Object.keys(original).some(
      (key) => current[key] !== original[key]
    );
    setHasChanges(dirty);
  }, [form, originalData]);

  const handleUrlBlur = () => {
    const current = (form.logoPath || '').trim();
    if (!current) {
      setError('');
      return;
    }
    if (/^https?:\/\//i.test(current) || current.startsWith('data:')) {
      try {
        new URL(current);
        setError('');
      } catch {
        setError('La URL del logo debe ser válida o dejarse vacía.');
      }
      return;
    }
    // rutas relativas se aceptan tal cual
    setError('');
  };

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin || saving) return;

    if (!form.nombreEmpresa.trim()) {
      setError("El nombre de la empresa es obligatorio.");
      return;
    }
    if (!form.monedaSimbolo.trim()) {
      setError("El símbolo de la moneda es obligatorio.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = {
        nombreEmpresa: form.nombreEmpresa.trim(),
        rucNit: form.rucNit.trim(),
        direccion: form.direccion.trim(),
        monedaSimbolo: form.monedaSimbolo.trim(),
        monedaNombre: form.monedaNombre.trim(),
        telefonoSoporte: form.telefonoSoporte.trim(),
        emailSoporte: form.emailSoporte.trim(),
        logoPath: form.logoPath ? form.logoPath.trim() : null,
      };
      const updated = await updateParametrosSistema(payload);
      const normalized = normalizeData(updated);
      setForm({ ...normalized });
      setOriginalData({ ...normalized });
      setHasChanges(false);
      if (updated?.monedaSimbolo) {
        sessionStorage.setItem('currencySymbol', updated.monedaSimbolo);
      }
      if (updated?.logoPath) {
        sessionStorage.setItem('logoPath', updated.logoPath);
      }
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setForm({ ...originalData });
    setError("");
    setHasChanges(false);
  };

  const previewSrc = resolveLogoSrc(form.logoPath);
  const isSvgPreview = /\.svg(\?.*)?$/i.test(previewSrc);

  const isPristine = (field) => {
    const original = originalData?.[field] ?? "";
    return (form?.[field] ?? "") === original;
  };

  return (
    <div className="config-modal-overlay" onClick={onClose}>
      <div className="config-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="config-modal-header badge-style">
          <div className="badge-content">
            <i className="bi bi-gear-fill"></i>
            <h3>Configuración del sistema</h3>
          </div>
          <button className="config-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form className="config-form" onSubmit={handleSubmit}>
          <div className="config-modal-body">
            {error && <div className="config-alert error">{error}</div>}
            {!isAdmin && (
              <div className="config-alert warning">
                No tiene permisos para modificar la configuración.
              </div>
            )}

            {loading ? (
              <div className="config-loading">Cargando configuración…</div>
            ) : (
              <>
                <section className="config-section">
                  <div className="config-section-header">
                    <h4>Datos de la empresa</h4>
                    <p>Información general visible en reportes y facturas.</p>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="config-field">
                        <span className="config-label">
                          Nombre de la empresa{" "}
                          <span className="required-star">*</span>
                        </span>
                        <input
                          type="text"
                          value={form.nombreEmpresa}
                          onChange={handleChange("nombreEmpresa")}
                          className={
                            isPristine("nombreEmpresa") ? "pristine" : ""
                          }
                          disabled={!isAdmin}
                        />
                      </label>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="config-field">
                        <span className="config-label">RUC / NIT / RNC</span>
                        <input
                          type="text"
                          value={form.rucNit}
                          onChange={handleChange("rucNit")}
                          className={isPristine("rucNit") ? "pristine" : ""}
                          disabled={!isAdmin}
                        />
                      </label>
                    </div>
                    <div className="col-12">
                      <label className="config-field">
                        <span className="config-label">Dirección</span>
                        <textarea
                          rows="3"
                          value={form.direccion}
                          onChange={handleChange("direccion")}
                          className={
                            isPristine("direccion") ? "pristine" : ""
                          }
                          disabled={!isAdmin}
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <div className="row g-4">
                  <div className="col-12 col-lg-6">
                    <section className="config-section h-100">
                      <div className="config-section-header">
                        <h4>Moneda y formato</h4>
                        <p>El símbolo se usará en facturas y reportes.</p>
                      </div>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="config-field">
                            <span className="config-label">
                              Símbolo <span className="required-star">*</span>
                            </span>
                            <input
                              type="text"
                              value={form.monedaSimbolo}
                              onChange={handleChange("monedaSimbolo")}
                              className={
                                isPristine("monedaSimbolo") ? "pristine" : ""
                              }
                              disabled={!isAdmin}
                            />
                          </label>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="config-field">
                            <span className="config-label">
                              Nombre de la moneda
                            </span>
                            <input
                              type="text"
                              value={form.monedaNombre}
                              onChange={handleChange("monedaNombre")}
                              className={
                                isPristine("monedaNombre") ? "pristine" : ""
                              }
                              disabled={!isAdmin}
                            />
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="col-12 col-lg-6">
                    <section className="config-section h-100">
                      <div className="config-section-header">
                        <h4>Contacto y soporte</h4>
                        <p>Se mostrará en facturas y secciones de contacto.</p>
                      </div>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="config-field">
                            <span className="config-label">
                              Teléfono de soporte
                            </span>
                            <input
                              type="text"
                              value={form.telefonoSoporte}
                              onChange={handleChange("telefonoSoporte")}
                              className={
                                isPristine("telefonoSoporte") ? "pristine" : ""
                              }
                              disabled={!isAdmin}
                            />
                          </label>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="config-field">
                            <span className="config-label">Email de soporte</span>
                            <input
                              type="email"
                              value={form.emailSoporte}
                              onChange={handleChange("emailSoporte")}
                              className={
                                isPristine("emailSoporte") ? "pristine" : ""
                              }
                              disabled={!isAdmin}
                            />
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="col-12 col-lg-6">
                    <section className="config-section h-100">
                      <div className="config-section-header">
                        <h4>Identidad visual</h4>
                        <p>Este logo aparecerá en encabezados y facturas.</p>
                      </div>
                      <div className="config-logo-block">
                        <div className="config-logo-preview">
                          {previewSrc ? (
                            isSvgPreview ? (
                              <object
                                type="image/svg+xml"
                                data={previewSrc}
                                aria-label="Logo actual"
                              />
                            ) : (
                              <img src={previewSrc} alt="Logo actual" />
                            )
                          ) : (
                            <div className="config-logo-placeholder">
                              <i className="bi bi-image"></i>
                              <span>Sin logo asignado</span>
                            </div>
                          )}
                        </div>
                        <div className="config-logo-input">
                          <label className="config-field">
                            <span className="config-label">Ruta / URL guardada</span>
                            <input
                              type="text"
                              value={form.logoPath}
                              onChange={handleChange("logoPath")}
                              onBlur={handleUrlBlur}
                              className={isPristine("logoPath") ? "pristine" : ""}
                              disabled={!isAdmin}
                            />
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <div className={`config-modal-footer ${hasChanges ? "visible" : ""}`}>
              <button
                type="button"
                className="btn btn-outline-danger config-cancel-btn"
                onClick={handleCancelChanges}
              >
                <i className="bi bi-x-circle"></i>
                Descartar
              </button>
              <button
                type="submit"
                className="btn btn-primary config-save-btn"
                disabled={saving || loading}
              >
                <i className="bi bi-check2-circle"></i>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ConfigModal;
