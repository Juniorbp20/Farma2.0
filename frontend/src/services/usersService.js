// src/services/usersService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

const handleErrors = async (res, defaultMsg) => {
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || defaultMsg);
  }
};

export async function getUsuarios() {
  const res = await fetch(`${API_URL}/usuarios`, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al obtener usuarios.");
  return res.json();
}

export async function getRoles() {
  const res = await fetch(`${API_URL}/roles`, { headers: { ...authHeader() } });
  await handleErrors(res, "Error al obtener roles.");
  return res.json();
}

export async function createUsuario(usuario) {
  const res = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(usuario),
  });
  await handleErrors(res, "Error al crear usuario.");
  return res.json();
}

export async function updateUsuario(id, usuario) {
  const res = await fetch(`${API_URL}/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(usuario),
  });
  await handleErrors(res, "Error al actualizar usuario.");
  return res.json();
}

export async function deleteUsuario(id) {
  const res = await fetch(`${API_URL}/usuarios/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });
  await handleErrors(res, "Error al eliminar usuario.");
  return res.json();
}