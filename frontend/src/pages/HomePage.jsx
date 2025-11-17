import React, { useEffect, useState } from 'react';
import './HomePage.css'; 
import { getParametrosSistema } from '../services/configService';

function Card({ icon, title, desc, action, disabled }) {
  return (
    <div className={`col-12 col-sm-6 col-lg-3 mb-3`}>
      <div className={`card card-menu-home h-100 shadow-sm ${disabled ? 'opacity-25' : ''}`} onClick={disabled ? null : action} style={{ cursor: disabled ? 'default' : 'pointer' }}>
        <div className="card-body d-flex flex-column">
          
          {/* INICIO: Nueva estructura para Icono (Arriba) y Título (Abajo) */}
          <div className="d-flex flex-column align-items-center mb-3">
            <i className={`bi ${icon}`} style={{ fontSize: 48, color: '#0d6efd' }}></i>
            <h5 className="card-title mt-2 mb-0 text-center">{title}</h5>
          </div>
          {/* FIN: Nueva estructura */}
          
          <p className="card-text flex-grow-1 text-muted text-center">{desc}</p>
          {/* <button className="btn btn-primary mt-auto" onClick={action} disabled={disabled}>
            Abrir
          </button> */}
        </div>
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
                  <span>En Línea</span>
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
              <div className="status-indicator">
                {/* <div className="status-dot-container">
                  <span className="status-dot"></span>
                </div>
                <span>En Línea</span> */}
              </div>
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
        <p className="text-muted mt-2 opacity-75 text-center">Panel principal del sistema farmacéutico.</p>
      </div>

      <div className="row">
        
        <Card
          icon="bi-cart"
          title="Facturación"
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
          desc="Órdenes de compra y recepción de productos."
          action={() => onNavigate({ view: 'inventario', tab: 'compras' })}
        />
        <Card
          icon="bi-capsule"
          title="Productos"
          desc="Catálogo de medicamentos, precios y stock mínimo."
          action={() => onNavigate('productos')}
        />
        <Card
          icon="bi-graph-up"
          title="Reportes"
          desc="Reportes de ventas, stock, vencimientos y más."
          action={() => alert('Módulo de reportes próximamente')}
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
        {/* Configuración se gestiona ahora solo desde el icono superior */}
      </div>
    </div>
  );
}

export default HomePage;




