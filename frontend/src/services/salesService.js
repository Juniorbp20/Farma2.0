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

export async function getVentaPdf(ventaId) {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/pdf`, {
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    try {
      const err = await res.json();
      throw new Error(err?.message || 'No se pudo obtener el PDF de la factura');
    } catch {
      throw new Error('No se pudo obtener el PDF de la factura');
    }
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = `factura_${ventaId}.pdf`;
  const match = disposition.match(/filename="?([^";]+)"?/i);
  if (match?.[1]) filename = match[1];
  return { blob, filename };
}
