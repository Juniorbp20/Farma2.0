// src/services/usersService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

export async function getUsuarios() {
  const res = await fetch(`${API_URL}/usuarios`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRoles() {
  const res = await fetch(`${API_URL}/roles`, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUsuario(usuario) {
  const res = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(usuario),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUsuario(id, usuario) {
  const res = await fetch(`${API_URL}/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(usuario),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUsuario(id) {
  const res = await fetch(`${API_URL}/usuarios/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

