import React from 'react';
import './HomePage.css'; 

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
  const isAdmin = user?.rol === 'admin';

  const displayName = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || user?.username;

  return (
    <div className="container py-4">
      <div className="mb-4 text-center user-select-none">
        <div className="status-block">
            <div className="status-indicator">
              <div className="status-dot-container">
                <span className="status-dot"></span>
              </div>
              <span>En Línea</span>
            </div>
        </div>
        <h1 className="display-4 fw-bold text-uppercase opacity-75">Bienvenido a FManager</h1>
        <div className="d-flex justify-content-center gap-2">
          <div className="info-block bg-primary text-white p-2 px-3 rounded-2 shadow-sm text-uppercase fw-bold">
            {displayName}
          </div>

          <div className="info-block bg-primary text-white p-2 px-3 rounded-2 shadow-sm text-uppercase fw-bold">
            {user?.rol} - {user?.username}
          </div>
        </div>
        <p className="text-muted mt-2 opacity-75">Panel principal del sistema farmacéutico.</p>
      </div>

      <div className="row">
        
        <Card
          icon="bi-cart"
          title="Facturación"
          desc="Registrar ventas, aplicar descuentos y emitir comprobantes."
          action={() => onNavigate('pos')}
        />
        <Card
          icon="bi-capsule"
          title="Productos"
          desc="Catálogo de medicamentos, precios y stock mínimo."
          action={() => onNavigate('productos')}
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
          action={() => alert('Módulo de compras próximamente')}
          disabled
        />
        <Card
          icon="bi-graph-up"
          title="Reportes"
          desc="Reportes de ventas, stock, vencimientos y más."
          action={() => alert('Módulo de reportes próximamente')}
          disabled
        />
        <Card
          icon="bi-truck"
          title="Proveedores"
          desc="Alta de proveedores y condiciones comerciales."
          action={() => alert('Módulo de proveedores próximamente')}
          disabled
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
        {isAdmin && (
          <Card
            icon="bi-gear"
            title="Configuración"
            desc="Parámetros generales, catálogos y seguridad."
            action={() => alert('Módulo de configuración próximamente')}
            disabled
          />
        )}
      </div>
    </div>
  );
}

export default HomePage;