import React from 'react';
import './TabBar.css';

export default function TabBar({
  tabs = [],
  active,
  onSelect,
  className = '',
  ariaLabel = 'Tab bar',
}) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;

  return (
    <div className={`btn-group tab-bar ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            className={`btn btn-outline-primary cursor-selectable ${isActive ? 'active' : ''}`}
            onClick={() => onSelect && onSelect(tab.value)}
            disabled={tab.disabled}
            aria-pressed={isActive}
          >
            {tab.icon && <i className={`${tab.icon} me-2`} aria-hidden="true" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
