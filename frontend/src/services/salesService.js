// src/services/salesService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

export async function crearVenta(venta) {
  const res = await fetch(`${API_URL}/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(venta),
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || "Error al crear la venta");
  }
  return res.json();
}