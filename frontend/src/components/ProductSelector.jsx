// src/components/ProductSelector.js
import React, { useState, useEffect, useRef } from 'react';
import { buscarProductos } from '../services/productsService';
import useDebounce from '../hooks/useDebounce';

function ProductSelector({ onSelect, placeholder = "Buscar producto..." }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      buscarProductosAsync(debouncedQuery);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscarProductosAsync = async (searchQuery) => {
    try {
      setLoading(true);
      const productos = await buscarProductos(searchQuery);
      setSuggestions(productos);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error buscando productos:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (producto) => {
    onSelect(producto);
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="position-relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleInputFocus}
      />
      
      {showSuggestions && (query.trim() || suggestions.length > 0) && (
        <div className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
          {loading && (
            <div className="list-group-item text-center">
              <div className="spinner-border spinner-border-sm me-2" role="status"></div>
              Buscando...
            </div>
          )}
          
          {!loading && suggestions.length === 0 && query.trim() && (
            <div className="list-group-item text-muted text-center">
              No se encontraron productos
            </div>
          )}
          
          {!loading && suggestions.map(producto => (
            <button
              key={producto.ProductoID}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => handleSelect(producto)}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="mb-1">{producto.Nombre}</h6>
                  {producto.Presentacion && (
                    <small className="text-muted">{producto.Presentacion}</small>
                  )}
                  <br />
                  <small className="text-muted">ID: {producto.ProductoID}</small>
                </div>
                <div className="text-end">
                  <span className="badge bg-primary">${producto.Precio?.toFixed(2)}</span>
                  <br />
                  <small className="text-muted">Stock: {producto.Stock || 0}</small>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductSelector;