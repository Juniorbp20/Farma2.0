// src/components/StatsCard.js
import React from 'react';

function StatsCard({ title, value, icon, color = "primary", subtitle, trend }) {
  const renderSubtitle = () => {
    if (!subtitle) return null;
    if (typeof subtitle === 'string') {
      return <small className="text-muted">{subtitle}</small>;
    }
    return subtitle;
  };

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column align-items-center text-center">
        <div
          className={`bg-${color} text-white rounded-circle d-inline-flex align-items-center justify-content-center stats-card-icon mb-2`}
          style={{ width: 56, height: 56 }}
        >
          <i className={`bi ${icon} fs-4`}></i>
        </div>
        <h6 className="card-title text-muted mb-1">{title}</h6>
        <h3 className="mb-0">{value}</h3>
        {subtitle && <div className="stats-card-subtitle mt-2">{renderSubtitle()}</div>}
        {trend && (
          <div className={`small ${trend.positive ? 'text-success' : 'text-danger'}`}>
            <i className={`bi ${trend.positive ? 'bi-arrow-up' : 'bi-arrow-down'}`}></i>
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
