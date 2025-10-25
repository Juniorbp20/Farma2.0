// src/services/proveedoresService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

const handleErrors = async (res, defaultMsg) => {
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || defaultMsg);
  }
};

export async function getProveedores() {
  const res = await fetch(`${API_URL}/proveedores`, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener proveedores.');
  return res.json();
}

export async function createProveedor(payload) {
  const res = await fetch(`${API_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al crear proveedor.');
  return res.json();
}

export async function updateProveedor(id, payload) {
  const res = await fetch(`${API_URL}/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al actualizar proveedor.');
  return res.json();
}

export async function deleteProveedor(id) {
  const res = await fetch(`${API_URL}/proveedores/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });
  await handleErrors(res, 'Error al eliminar proveedor.');
  return res.json();
}

