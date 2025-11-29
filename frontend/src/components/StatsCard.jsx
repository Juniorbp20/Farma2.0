// src/components/StatsCard.js
import React from 'react';

function StatsCard({ title, value, icon, color = "primary", subtitle, trend, valueChip = false }) {
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
        {valueChip ? (
          <span className="stats-card-chip stats-card-chip-primary stats-card-chip-lg">
            <i className="bi bi-piggy-bank-fill" aria-hidden="true"></i>
            <span className="stats-card-chip-text">
              <strong>C:</strong> {value}
            </span>
          </span>
        ) : (
          <h3 className="mb-0 stats-card-value">{value}</h3>
        )}
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
