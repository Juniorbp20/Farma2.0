// src/components/SearchInput.js
import React from 'react';
import useDebounce from '../hooks/useDebounce';

function SearchInput({ 
  value, 
  onChange, 
  placeholder = "Buscar...", 
  delay = 300,
  className = "form-control",
  icon = "bi-search"
}) {
  const debouncedValue = useDebounce(value, delay);

  React.useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  return (
    <div className="position-relative">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <i className={`bi ${icon} position-absolute`} 
         style={{ 
           right: '10px', 
           top: '50%', 
           transform: 'translateY(-50%)', 
           color: '#6c757d' 
         }}
      />
    </div>
  );
}

export default SearchInput;