// src/pages/LoginPage.js
import React, { useState } from 'react';
import { login } from '../services/authService';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user } = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="row w-100">
        <div className="col-12 col-sm-8 col-md-6 col-lg-4 mx-auto">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h3 className="text-center mb-4">Iniciar Sesión</h3>
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Usuario</label>
                  <input
                    type="text"
                    className="form-control"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingrese su usuario"
                    autoFocus
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Contraseña</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? 'Ingresando...' : 'Entrar'}
                </button>
              </form>
            </div>
          </div>
          <p className="text-center text-muted mt-3" style={{ fontSize: '0.9rem' }}>
            Acceso restringido. Contacte al administrador si no tiene credenciales.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

