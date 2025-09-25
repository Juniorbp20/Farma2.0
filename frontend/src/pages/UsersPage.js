// src/pages/UsersPage.js
import React, { useEffect, useState } from 'react';
import { getUsuarios, getRoles, createUsuario, updateUsuario, deleteUsuario } from '../services/usersService';

function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState('success');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ Nombres: '', Apellidos: '', Username: '', Password: '', Email: '', Telefono: '', RolID: '', Activo: true });

  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (mensaje) { const t = setTimeout(() => setMensaje(''), 4000); return () => clearTimeout(t); } }, [mensaje]);

  async function cargar() {
    const [u, r] = await Promise.all([getUsuarios(), getRoles()]);
    setUsuarios(u);
    setRoles(r);
  }

  function onEdit(u) {
    setEditando(u);
    setForm({
      Nombres: u.Nombres || '',
      Apellidos: u.Apellidos || '',
      Username: u.Username || '',
      Password: '',
      Email: u.Email || '',
      Telefono: u.Telefono || '',
      RolID: String(u.RolID || ''),
      Activo: !!u.Activo,
    });
  }

  function onCancel() {
    setEditando(null);
    setForm({ Nombres: '', Apellidos: '', Username: '', Password: '', Email: '', Telefono: '', RolID: '', Activo: true });
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editando) {
        const payload = { ...form };
        if (!payload.Password) delete payload.Password; // no cambiar
        await updateUsuario(editando.UsuarioID, payload);
        setMensaje('Usuario actualizado con éxito');
      } else {
        await createUsuario(form);
        setMensaje('Usuario creado con éxito');
      }
      setTipoMensaje('success');
      onCancel();
      await cargar();
    } catch (err) {
      setMensaje('Error: ' + err.message);
      setTipoMensaje('error');
    }
  }

  async function onDelete(u) {
    if (!window.confirm(`¿Desactivar usuario ${u.Username}?`)) return;
    try {
      await deleteUsuario(u.UsuarioID);
      setMensaje('Usuario desactivado');
      setTipoMensaje('success');
      await cargar();
    } catch (err) {
      setMensaje('Error: ' + err.message);
      setTipoMensaje('error');
    }
  }

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Gestión de Usuarios</h2>
      </div>

      {mensaje && (
        <div className={`alert ${tipoMensaje === 'success' ? 'alert-success' : 'alert-danger'}`}>{mensaje}</div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h5>
              <form onSubmit={handleSubmit}>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Nombres</label>
                    <input className="form-control" name="Nombres" value={form.Nombres} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Apellidos</label>
                    <input className="form-control" name="Apellidos" value={form.Apellidos} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Usuario</label>
                    <input className="form-control" name="Username" value={form.Username} onChange={handleChange} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Contraseña {editando ? '(dejar en blanco para no cambiar)' : ''}</label>
                    <input type="password" className="form-control" name="Password" value={form.Password} onChange={handleChange} required={!editando} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Email</label>
                    <input className="form-control" name="Email" value={form.Email} onChange={handleChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input className="form-control" name="Telefono" value={form.Telefono} onChange={handleChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Rol</label>
                    <select className="form-select" name="RolID" value={form.RolID} onChange={handleChange} required>
                      <option value="">Seleccione</option>
                      {roles.map(r => (
                        <option key={r.RolID} value={r.RolID}>{r.NombreRol}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6 d-flex align-items-end">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="activo" name="Activo" checked={form.Activo} onChange={handleChange} />
                      <label className="form-check-label" htmlFor="activo">Activo</label>
                    </div>
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-primary" type="submit">{editando ? 'Actualizar' : 'Crear'}</button>
                  {editando && <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="table-responsive">
            <table className="table table-striped table-bordered align-middle">
              <thead className="table-dark">
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.UsuarioID}>
                    <td>{u.UsuarioID}</td>
                    <td>{u.Username}</td>
                    <td>{u.Nombres} {u.Apellidos}</td>
                    <td>{u.NombreRol || u.RolID}</td>
                    <td>{u.Activo ? 'Sí' : 'No'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary me-2" onClick={() => onEdit(u)} title="Editar"><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-sm btn-danger" onClick={() => onDelete(u)} title="Desactivar"><i className="bi bi-person-dash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsersPage;

