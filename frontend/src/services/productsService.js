// src/services/productsService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

const handleErrors = async (res, defaultMsg) => {
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || defaultMsg);
  }
};

export async function getProductos() {
  const res = await fetch(`${API_URL}/productos`, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al obtener productos.");
  return res.json();
}

export async function buscarProductos(q) {
  const url = new URL(`${API_URL}/productos/buscar`);
  url.searchParams.set('q', q || '');
  const res = await fetch(url, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al buscar productos.");
  return res.json();
}

export async function getProductoPorCodigo(codigo) {
  throw new Error('No disponible');
}

export async function createProducto(producto) {
  const res = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(producto),
  });
  await handleErrors(res, "Error al crear producto.");
  return res.json();
}

export async function updateProducto(id, producto) {
  const res = await fetch(`${API_URL}/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(producto),
  });
  await handleErrors(res, "Error al actualizar producto.");
  return res.json();
}

export async function deleteProducto(id) {
  const res = await fetch(`${API_URL}/productos/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });
  await handleErrors(res, "Error al eliminar producto.");
  return res.json();
}