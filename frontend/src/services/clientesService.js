// src/services/clientesService.js
import { authHeader } from './authService';

const API_URL = process.env.REACT_APP_API_URL;

//* Para la tabla clientes
export const getClientes = async () => {
  const res = await fetch(`${API_URL}/clientes`, {
    headers: { ...authHeader() },
  });
  return res.json();
};

export const createCliente = async (cliente) => {
  const res = await fetch(`${API_URL}/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(cliente),
  });
  if (!res.ok) {
    // Obtener el cuerpo como JSON para extraer el mensaje
    const errorBody = await res.json();
    // Lanzar un nuevo Error con solo el string del mensaje
    throw new Error(errorBody.message || "Error desconocido al crear cliente");
  }
  return res.json();
};

export const updateCliente = async (id, cliente) => {
  const res = await fetch(`${API_URL}/clientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(cliente),
  });
  if (!res.ok) {
    // Obtener el cuerpo como JSON para extraer el mensaje
    const errorBody = await res.json();
    // Lanzar un nuevo Error con solo el string del mensaje
    throw new Error(errorBody.message || "Error desconocido al actualizar cliente");
  }
  return res.json();
};

export const deleteCliente = async (id) => {
  const res = await fetch(`${API_URL}/clientes/${id}`, {
    method: "DELETE",
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    // Obtener el cuerpo como JSON para extraer el mensaje
    const errorBody = await res.json();
    // Lanzar un nuevo Error con solo el string del mensaje
    throw new Error(errorBody.message || "Error desconocido al eliminar cliente");
  }
  return res.json();
};

//* Para la tabla de tipo de documentos
export const getTiposDocumentos = async () => {
  const res = await fetch(`${API_URL}/tiposdocumentos`, { headers: { ...authHeader() } });
  return res.json();
};