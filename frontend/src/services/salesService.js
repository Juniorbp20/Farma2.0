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

export async function getVentas(params = {}) {
  try {
    const url = new URL(`${API_URL}/ventas`);
    if (params.from) {
      const d = new Date(params.from);
      d.setHours(0, 0, 0, 0);
      url.searchParams.set('from', d.toISOString());
    }
    if (params.to) {
      const d = new Date(params.to);
      d.setHours(23, 59, 59, 999);
      url.searchParams.set('to', d.toISOString());
    }
    if (params.clienteId) url.searchParams.set('clienteId', params.clienteId);
    if (params.estado) url.searchParams.set('estado', params.estado);
    const res = await fetch(url, { headers: { ...authHeader() } });
    if (!res.ok) {
      let m = 'Error al obtener ventas';
      try { const e = await res.json(); m = e?.message || m; } catch {}
      throw new Error(m);
    }
    return res.json();
  } catch (e) {
    if (e?.message && e.message.toLowerCase().includes('failed to fetch')) {
      throw new Error('No se pudo conectar con el servidor. Verifique que el backend esté activo y la URL REACT_APP_API_URL sea correcta.');
    }
    throw e;
  }
}


export async function getVenta(ventaId) {
  const res = await fetch(`${API_URL}/ventas/${ventaId}`, { headers: { ...authHeader() } });
  if (!res.ok) {
    let m = 'Error al obtener la venta';
    try { const e = await res.json(); m = e?.message || m; } catch {}
    throw new Error(m);
  }
  return res.json();
}

export async function getHistorialDia(fechaIso) {
  const url = new URL(`${API_URL}/ventas/historial-dia`);
  if (fechaIso) url.searchParams.set('fecha', fechaIso);
  const res = await fetch(url, { headers: { ...authHeader() } });
  if (!res.ok) {
    let m = 'Error al obtener historial del dia';
    try { const e = await res.json(); m = e?.message || m; } catch {}
    throw new Error(m);
  }
  return res.json();
}

export async function aplicarDevolucion(ventaId, payload) {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/devolucion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    let m = 'Error al aplicar devolución';
    try { const e = await res.json(); m = e?.message || m; } catch {}
    throw new Error(m);
  }
  return res.json();
}

export async function anularVenta(ventaId, motivo = '') {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/anular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ motivo })
  });
  if (!res.ok) {
    try {
      const err = await res.json();
      throw new Error(err?.message || 'No se pudo anular la venta');
    } catch {
      throw new Error('No se pudo anular la venta');
    }
  }
  return res.json();
}
