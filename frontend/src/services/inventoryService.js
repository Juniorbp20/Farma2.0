// src/services/inventoryService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

const handleErrors = async (res, defaultMsg) => {
  if (!res.ok) {
    let message = defaultMsg;
    try {
      const errorBody = await res.json();
      message = errorBody?.message || defaultMsg;
    } catch (err) {
    }
    throw new Error(message);
  }
};

export async function getInventarioResumen() {
  const res = await fetch(`${API_URL}/inventario/resumen`, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener resumen de inventario.');
  return res.json();
}

export async function getLotes(params = {}) {
  const url = new URL(`${API_URL}/inventario/lotes`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });
  const res = await fetch(url, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener lotes.');
  return res.json();
}

export async function getLoteDetalle(id) {
  const res = await fetch(`${API_URL}/inventario/lotes/${id}`, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener detalle del lote.');
  return res.json();
}

export async function createLote(payload) {
  const res = await fetch(`${API_URL}/inventario/lotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al crear lote.');
  return res.json();
}

export async function updateLote(id, payload) {
  const res = await fetch(`${API_URL}/inventario/lotes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al actualizar lote.');
  return res.json();
}

export async function deactivateLote(id, payload = {}) {
  const res = await fetch(`${API_URL}/inventario/lotes/${id}/desactivar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al desactivar lote.');
  return res.json();
}

export async function reactivateLote(id) {
  const res = await fetch(`${API_URL}/inventario/lotes/${id}/reactivar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  await handleErrors(res, 'Error al reactivar lote.');
  return res.json();
}

export async function ajustarStock(payload) {
  const res = await fetch(`${API_URL}/inventario/ajustar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al ajustar stock.');
  return res.json();
}

export async function getCompras(params = {}) {
  const url = new URL(`${API_URL}/inventario/compras`);
  if (params.page != null) url.searchParams.set('page', params.page);
  if (params.pageSize != null) url.searchParams.set('pageSize', params.pageSize);
  const res = await fetch(url, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener compras.');
  return res.json();
}

export async function getCompra(id) {
  const res = await fetch(`${API_URL}/inventario/compras/${id}`, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener la compra.');
  return res.json();
}

export async function createCompra(payload) {
  const res = await fetch(`${API_URL}/inventario/compras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  await handleErrors(res, 'Error al registrar la compra.');
  return res.json();
}

export async function getMarcas(params = {}) {
  const url = new URL(`${API_URL}/inventario/marcas`);
  if (params.incluirInactivas) url.searchParams.set('incluirInactivas', 'true');
  const res = await fetch(url, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener las marcas.');
  return res.json();
}

export async function getMovimientosRecientesInventario(params = {}) {
  const url = new URL(`${API_URL}/inventario/movimientos-recientes`);
  const entries = Object.entries(params || {});
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });
  const res = await fetch(url, { headers: { ...authHeader() } });
  await handleErrors(res, 'Error al obtener movimientos de inventario.');
  return res.json();
}

