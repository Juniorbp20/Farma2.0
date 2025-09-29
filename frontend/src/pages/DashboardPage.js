// src/pages/DashboardPage.js
import React, { useEffect, useState } from 'react';
import StatsCard from '../components/StatsCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { getResumenInventario } from '../services/inventoryService';
import { getClientes } from '../services/clientesService';
import { getProductos } from '../services/productsService';
import { formatCurrency, formatNumber } from '../utils/formatters';

function DashboardPage() {
  const [stats, setStats] = useState({
    productos: 0,
    clientes: 0,
    stockBajo: 0,
    vencimientosProximos: 0,
    valorInventario: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      const [resumenInventario, clientes, productos] = await Promise.all([
        getResumenInventario(),
        getClientes(),
        getProductos()
      ]);

      const stockBajo = resumenInventario.filter(item => 
        item.Stock <= item.StockMinimo
      ).length;

      const vencimientosProximos = resumenInventario.reduce((total, item) => 
        total + item.VencimientosProximos, 0
      );

      const valorInventario = productos.reduce((total, producto) => 
        total + (producto.Stock * producto.Precio), 0
      );

      setStats({
        productos: productos.length,
        clientes: clientes.length,
        stockBajo,
        vencimientosProximos,
        valorInventario
      });
    } catch (err) {
      setError('Error cargando estadísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando estadísticas..." />;

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard</h2>
        <button className="btn btn-outline-primary" onClick={cargarEstadisticas}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Actualizar
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <StatsCard
            title="Total Productos"
            value={formatNumber(stats.productos)}
            icon="bi-capsule"
            color="primary"
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <StatsCard
            title="Total Clientes"
            value={formatNumber(stats.clientes)}
            icon="bi-people"
            color="success"
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <StatsCard
            title="Stock Bajo"
            value={formatNumber(stats.stockBajo)}
            icon="bi-exclamation-triangle"
            color="warning"
            subtitle="Productos bajo mínimo"
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <StatsCard
            title="Vencimientos Próximos"
            value={formatNumber(stats.vencimientosProximos)}
            icon="bi-calendar-x"
            color="danger"
            subtitle="Próximos 30 días"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">
                <i className="bi bi-currency-dollar me-2"></i>
                Valor Total del Inventario
              </h5>
              <h2 className="text-primary mb-0">
                {formatCurrency(stats.valorInventario)}
              </h2>
              <small className="text-muted">
                Basado en precios actuales y stock disponible
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;