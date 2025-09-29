// src/components/StatsCard.js
import React from 'react';

function StatsCard({ title, value, icon, color = "primary", subtitle, trend }) {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center">
          <div className={`bg-${color} text-white rounded-circle p-3 me-3`}>
            <i className={`bi ${icon} fs-4`}></i>
          </div>
          <div className="flex-grow-1">
            <h6 className="card-title text-muted mb-1">{title}</h6>
            <h3 className="mb-0">{value}</h3>
            {subtitle && <small className="text-muted">{subtitle}</small>}
            {trend && (
              <div className={`small ${trend.positive ? 'text-success' : 'text-danger'}`}>
                <i className={`bi ${trend.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`}></i>
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsCard;