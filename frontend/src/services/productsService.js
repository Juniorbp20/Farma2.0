// src/services/productsService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

export async function getProductos() {
  const res = await fetch(`${API_URL}/productos`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function buscarProductos(q) {
  const url = new URL(`${API_URL}/productos/buscar`);
  url.searchParams.set('q', q || '');
  const res = await fetch(url, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Búsqueda por código de barras no disponible en DB actual
export async function getProductoPorCodigo(codigo) {
  throw new Error('No disponible');
}

export async function createProducto(producto) {
  const res = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(producto),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProducto(id, producto) {
  const res = await fetch(`${API_URL}/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(producto),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProducto(id) {
  const res = await fetch(`${API_URL}/productos/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
