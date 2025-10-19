// src/pages/ProductosPage.js
import React, { useEffect, useMemo, useState } from "react";
import "./ProductosPage.css";
import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
} from "../services/productsService";

function ProductoForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(
    () =>
      initial || { Nombre: "", Presentacion: "", Precio: "", StockMinimo: 10 }
  );
  useEffect(() => {
    setForm(
      initial || { Nombre: "", Presentacion: "", Precio: "", StockMinimo: 10 }
    );
  }, [initial]);
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      Precio: Number(form.Precio || 0),
      StockMinimo: Number(form.StockMinimo || 0),
    });
  };
  return (
    <form onSubmit={submit} className="row g-2">
      <div className="col-12 col-sm-6">
        <label className="form-label">Nombre</label>
        <input
          name="Nombre"
          className="form-control"
          value={form.Nombre}
          onChange={handle}
          required
        />
      </div>
      <div className="col-12 col-sm-6">
        <label className="form-label">Presentación</label>
        <input
          name="Presentacion"
          className="form-control"
          value={form.Presentacion}
          onChange={handle}
        />
      </div>
      <div className="col-6 col-sm-3">
        <label className="form-label">Precio compra ($RD)</label>
        <input
          name="Precio"
          type="number"
          step="0.01"
          min={0}
          className="form-control"
          value={form.Precio}
          onChange={handle}
        />
      </div>
      <div className="col-6 col-sm-3">
        <label className="form-label">Stock mínimo</label>
        <input
          name="StockMinimo"
          type="number"
          step="1"
          min={0}
          className="form-control"
          value={form.StockMinimo}
          onChange={handle}
        />
      </div>
      <div className="col-12 d-flex gap-2">
        <button className="btn btn-primary" type="submit">
          {initial?.ProductoID ? "Actualizar" : "Crear"}
        </button>
        {initial?.ProductoID && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    setOk("");
    try {
      setItems(await getProductos());
    } catch {
      setError("Error cargando productos");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter(
      (p) =>
        p.Nombre.toLowerCase().includes(f) ||
        (p.Presentacion || "").toLowerCase().includes(f)
    );
  }, [items, filter]);

  const onCreate = async (data) => {
    try {
      setError("");
      setOk("");
      await createProducto(data);
      setOk("Producto creado");
      await load();
    } catch (e) {
      setError(
        typeof e?.message === "string" ? e.message : "Error creando producto"
      );
    }
  };

  const onUpdate = async (data) => {
    try {
      setError("");
      setOk("");
      await updateProducto(editing.ProductoID, data);
      setOk("Producto actualizado");
      setEditing(null);
      await load();
    } catch (e) {
      setError(
        typeof e?.message === "string"
          ? e.message
          : "Error actualizando producto"
      );
    }
  };

  const onDelete = async (p) => {
    if (!window.confirm(`¿Eliminar ${p.Nombre}?`)) return;
    try {
      setError("");
      setOk("");
      await deleteProducto(p.ProductoID);
      setOk("Producto eliminado");
      await load();
    } catch (e) {
      setError(
        typeof e?.message === "string"
          ? e.message
          : "No se pudo eliminar (verifique lotes existentes)"
      );
    }
  };

  return (
    <div className="container productos-page-container py-3">
      <h3 className="mb-3">
        <i className="bi bi-capsule me-2"></i>Productos
      </h3>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {ok && <div className="alert alert-success py-2">{ok}</div>}
      {loading && <div className="alert alert-info py-2">Cargando...</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm producto-form-card">
            <div className="card-body">
              <h6 className="mb-3">{editing ? "Editar" : "Nuevo"} producto</h6>
              <ProductoForm
                initial={editing}
                onSubmit={editing ? onUpdate : onCreate}
                onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm producto-form-card">
            <div className="card-body">
              <div className="d-flex align-items-center mb-2">
                <input
                  className="form-control"
                  placeholder="Buscar por nombre o código"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="productos-list-wrapper">
                <div className="table-responsive">
                  <table className="table table-striped table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Nombre</th>
                        <th>Presentación</th>
                        <th className="text-end">Precio</th>
                        <th className="text-end">Stock</th>
                        <th className="text-end">Min</th>
                        <th style={{ width: 120 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.ProductoID}>
                          <td>{p.Nombre}</td>
                          <td>{p.Presentacion || "-"}</td>
                          <td className="text-end">
                            {Number(p.Precio || 0).toFixed(2)}
                          </td>
                          <td className="text-end">{p.Stock ?? 0}</td>
                          <td className="text-end">{p.StockMinimo ?? 10}</td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-primary"
                                onClick={() => setEditing(p)}
                                title="Editar"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={() => onDelete(p)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
