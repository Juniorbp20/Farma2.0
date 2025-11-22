import React, { useEffect, useState } from 'react';
import './HomePage.css';
import { getParametrosSistema } from '../services/configService';

function Card({ icon, title, desc, action, disabled }) {
  const cardClass = `card card-menu-home shadow-sm h-100 card-grid-item ${disabled ? 'card-disabled' : ''}`;
  return (
    <div className={cardClass}>
      <div
        className={`${disabled ? 'opacity-25' : ''} card-body d-flex flex-column`}
        onClick={disabled ? null : action}
      >
        <div className="d-flex flex-column align-items-center mb-2">
          <i className={`bi ${icon}`} style={{ fontSize: 42, color: '#0d6efd' }}></i>
          <h5 className="card-title mt-2 mb-0 text-center">{title}</h5>
        </div>
        <p className="card-text flex-grow-1 text-muted text-center">{desc}</p>
      </div>
    </div>
  );
}

function HomePage({ user, onNavigate }) {
  const [parametros, setParametros] = useState({ nombreEmpresa: '' });
  const [loadingNombre, setLoadingNombre] = useState(false);
  const isAdmin = user?.rol === 'admin' || String(user?.rolId) === '1';

  const displayName = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || user?.username;
  const systemName = (parametros?.nombreEmpresa || 'FManager').toUpperCase();

  useEffect(() => {
    let isMounted = true;
    setLoadingNombre(true);
    getParametrosSistema()
      .then((data) => {
        if (!isMounted) return;
        setParametros(data || { nombreEmpresa: '' });
      })
      .catch(() => {
        if (isMounted) setParametros({ nombreEmpresa: '' });
      })
      .finally(() => {
        if (isMounted) setLoadingNombre(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="container py-4">
      <div className="mb-4 user-select-none">
        <div className="row align-items-center justify-content-center gy-3 home-hero-row text-center text-lg-start">
          <div className="col-12 col-lg-2 d-flex justify-content-center justify-content-lg-start">
            <div className="status-block">
              <div className="status-indicator">
                <div className="status-dot-container">
                  <span className="status-dot"></span>
                </div>
                <span>En Linea</span>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-8 text-center">
            <h1 className="home-welcome-title fw-bold text-uppercase opacity-75 mb-0">
              Bienvenido a {loadingNombre ? '...' : systemName}
            </h1>
          </div>
          <div className="col-12 col-lg-2 d-none d-lg-flex justify-content-lg-end">
            <div className="status-block status-block--ghost" aria-hidden="true">
              <div className="status-indicator"></div>
            </div>
          </div>
        </div>
        <div className="d-flex justify-content-center gap-2">
          <div className="info-block bg-primary text-white p-2 px-3 rounded-2 shadow-sm text-uppercase fw-bold">
            {displayName}
          </div>

          <div className="info-block bg-primary text-white p-2 px-3 rounded-2 shadow-sm text-uppercase fw-bold">
            {user?.rol} - {user?.username}
          </div>
        </div>
        <p className="text-muted mt-2 opacity-75 text-center">Panel principal del sistema farmaceutico.</p>
      </div>

      <div className="home-cards-grid">
        <Card
          icon="bi-cart"
          title="Facturacion"
          desc="Registrar ventas y emitir comprobantes."
          action={() => onNavigate('pos')}
        />
        <Card
          icon="bi-box-seam"
          title="Inventario / Lotes"
          desc="Control de lotes, vencimientos y existencias."
          action={() => onNavigate('inventario')}
        />
        <Card
          icon="bi-bag-check"
          title="Compras"
          desc="Ordenes de compra y recepcion de productos."
          action={() => onNavigate({ view: 'inventario', tab: 'compras' })}
        />
        <Card
          icon="bi-capsule"
          title="Productos"
          desc="Catalogo de medicamentos, precios y stock minimo."
          action={() => onNavigate('productos')}
        />
        <Card
          icon="bi-graph-up"
          title="Reportes"
          desc="Reportes de ventas, stock, vencimientos y mas."
          action={() => onNavigate('reportes')}
        />
        <Card
          icon="bi-truck"
          title="Proveedores"
          desc="Alta de proveedores y condiciones comerciales."
          action={() => onNavigate('proveedores')}
        />
        <Card
          icon="bi-people"
          title="Clientes"
          desc="Gestione clientes: crear, actualizar y desactivar."
          action={() => onNavigate('clientes')}
        />
        {isAdmin && (
          <Card
            icon="bi-person-gear"
            title="Usuarios y Roles"
            desc="Gestione cuentas, roles y accesos al sistema."
            action={() => onNavigate('usuarios')}
          />
        )}
      </div>
    </div>
  );
}

export default HomePage;
