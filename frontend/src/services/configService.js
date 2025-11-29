// src/services/configService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

async function handleResponse(res, defaultMsg) {
  if (res.ok) return res.json();
  let message = defaultMsg;
  try {
    const body = await res.json();
    message = body?.message || defaultMsg;
  } catch (err) {
  }
  throw new Error(message);
}

export async function getParametrosSistema() {
  const res = await fetch(`${API_URL}/api/config/parametros-sistema`, {
    headers: { ...authHeader() },
  });
  return handleResponse(res, 'Error al obtener la configuración del sistema.');
}

export async function updateParametrosSistema(payload) {
  const res = await fetch(`${API_URL}/api/config/parametros-sistema`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, 'Error al actualizar la configuración.');
}

