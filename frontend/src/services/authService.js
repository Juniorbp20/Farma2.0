// src/services/authService.js
const API_URL = process.env.REACT_APP_API_URL;

export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.message || "Error de autenticación desconocido");
  }
  const data = await res.json();
  setToken(data.token);
  setUser(data.user);
  return data;
}

export function setToken(token) {
  sessionStorage.setItem('token', token);
}

export function getToken() {
  return sessionStorage.getItem('token');
}

export function setUser(user) {
  sessionStorage.setItem('user', JSON.stringify(user));
}

export function getUser() {
  const raw = sessionStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function logout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}