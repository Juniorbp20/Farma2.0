// src/pages/HomePage.js
import React from 'react';

function Card({ icon, title, desc, action, disabled }) {
  return (
    <div className={`col-12 col-sm-6 col-lg-4 mb-3`}>
      <div className={`card h-100 shadow-sm ${disabled ? 'opacity-75' : ''}`}>
        <div className="card-body d-flex flex-column">
          <div className="d-flex align-items-center mb-2">
            <i className={`bi ${icon} me-2`} style={{ fontSize: 28, color: '#0d6efd' }}></i>
            <h5 className="card-title mb-0">{title}</h5>
          </div>
          <p className="card-text flex-grow-1 text-muted">{desc}</p>
          <button className="btn btn-primary mt-2" onClick={action} disabled={disabled}>
            Abrir
          </button>
        </div>
      </div>
    </div>
  );
}

function HomePage({ user, onNavigate }) {
  const isAdmin = user?.rol === 'admin';

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h1 className="display-6">Bienvenido{user?.username ? `, ${user.username}` : ''}</h1>
        <p className="text-muted mb-1">Panel principal del sistema farmacéutico.</p>
        <span className="badge bg-secondary text-uppercase">{user?.rol}</span>
      </div>

      <div className="row">
        <Card
          icon="bi-cash-register"
          title="Punto de Venta"
          desc="Registrar ventas, aplicar descuentos y emitir comprobantes."
          action={() => onNavigate('pos')}
        />
        <Card
          icon="bi-people"
          title="Clientes"
          desc="Gestione clientes: crear, actualizar y desactivar."
          action={() => onNavigate('clientes')}
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
          icon="bi-truck"
          title="Proveedores"
          desc="Alta de proveedores y condiciones comerciales."
          action={() => alert('Módulo de proveedores próximamente')}
          disabled
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
