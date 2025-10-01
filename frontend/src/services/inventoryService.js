// src/services/inventoryService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

const handleErrors = async (res, defaultMsg) => {
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || defaultMsg);
  }
};

export async function getLotes() {
  const res = await fetch(`${API_URL}/inventario/lotes`, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al obtener lotes.");
  return res.json();
}

export async function addLote(lote) {
  const res = await fetch(`${API_URL}/inventario/lotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(lote),
  });
  await handleErrors(res, "Error al añadir lote.");
  return res.json();
}

export async function ajustarStock(payload) {
  const res = await fetch(`${API_URL}/inventario/ajustar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, "Error al ajustar stock.");
  return res.json();
}

export async function getResumenInventario() {
  const res = await fetch(`${API_URL}/inventario/resumen`, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al obtener resumen de inventario.");
  return res.json();
}