// src/services/authService.js
const API_URL = process.env.REACT_APP_API_URL;

export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  setToken(data.token);
  setUser(data.user);
  return data;
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function getToken() {
  return localStorage.getItem('token');
}

export function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser() {
  const raw = localStorage.getItem('user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

