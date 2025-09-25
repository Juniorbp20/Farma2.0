// src/services/inventoryService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

export async function getLotes() {
  const res = await fetch(`${API_URL}/inventario/lotes`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addLote(lote) {
  const res = await fetch(`${API_URL}/inventario/lotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(lote),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function ajustarStock(payload) {
  const res = await fetch(`${API_URL}/inventario/ajustar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getResumenInventario() {
  const res = await fetch(`${API_URL}/inventario/resumen`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

