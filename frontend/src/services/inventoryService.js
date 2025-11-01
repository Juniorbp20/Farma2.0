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
      // ignore parse errors
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

export async function deactivateLote(id, motivo) {
  const res = await fetch(`${API_URL}/inventario/lotes/${id}/desactivar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(motivo ? { motivo } : {}),
  });
  await handleErrors(res, 'Error al desactivar lote.');
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

export async function exportCompras(format = 'excel', params = {}) {
  const url = new URL(`${API_URL}/inventario/compras/export`);
  if (format) url.searchParams.set('format', format);
  if (params.page != null) url.searchParams.set('page', params.page);
  if (params.pageSize != null) url.searchParams.set('pageSize', params.pageSize);

  const res = await fetch(url, { headers: { ...authHeader() } });

  if (!res.ok) {
    let message = 'Error al exportar el historial de compras.';
    try {
      const errorBody = await res.json();
      message = errorBody?.message || message;
    } catch (err) {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const contentDisposition = res.headers.get('Content-Disposition') || '';
  let filename = format === 'pdf' ? 'historial_compras.pdf' : 'historial_compras.xlsx';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) filename = match[1];

  const blob = await res.blob();
  return { blob, filename };
}
