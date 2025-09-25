// src/services/salesService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

export async function crearVenta(venta) {
  const res = await fetch(`${API_URL}/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(venta),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

