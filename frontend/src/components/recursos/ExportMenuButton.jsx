import React, { useEffect, useMemo, useRef, useState } from 'react';

export const EXPORT_MENU_DEFAULT_OPTIONS = [
  { value: 'excel', label: 'Excel (.xlsx)', icon: 'bi-file-earmark-spreadsheet' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: 'bi-file-earmark-pdf' },
];

export default function ExportMenuButton({
  onExport,
  disabled = false,
  loading = false,
  options = EXPORT_MENU_DEFAULT_OPTIONS,
  label = 'Exportar',
  menuAlign = 'end',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const safeOptions = useMemo(() => {
    if (!Array.isArray(options) || options.length === 0) return [];
    return options;
  }, [options]);

  const hasOptions = safeOptions.length > 0;

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled || loading) setOpen(false);
  }, [disabled, loading]);

  const handleToggle = () => {
    if (disabled || loading || !hasOptions) return;
    setOpen((prev) => !prev);
  };

  const handleSelect = (value) => {
    if (!hasOptions) return;
    setOpen(false);
    onExport?.(value);
  };

  const menuClassName = `dropdown-menu dropdown-menu-${menuAlign} ${open ? 'show' : ''}`.trim();
  const wrapperClassName = `btn-group ${className}`.trim();

  return (
    <div className={wrapperClassName} ref={containerRef}>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-1"
        onClick={handleToggle}
        disabled={disabled || loading || !hasOptions}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            Generando...
          </>
        ) : (
          <>
            <i className="bi bi-download" aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </button>
      <ul className={menuClassName} aria-label="Opciones de exportacion">
        {hasOptions ? (
          safeOptions.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="dropdown-item d-flex align-items-center gap-2"
                onClick={() => handleSelect(option.value)}
                disabled={loading}
              >
                {option.icon && <i className={`bi ${option.icon}`} aria-hidden="true" />}
                <span>{option.label}</span>
              </button>
            </li>
          ))
        ) : (
          <li>
            <span className="dropdown-item text-muted small">Sin formatos disponibles</span>
          </li>
        )}
      </ul>
    </div>
  );
}
