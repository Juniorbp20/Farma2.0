// backend/store/ventasStore.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'ventas.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, JSON.stringify({ seq: 0, ventas: [] }, null, 2));
}

function loadAll() {
  ensureDataFile();
  const raw = fs.readFileSync(FILE_PATH, 'utf8');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { seq: 0, ventas: [] };
    if (!Array.isArray(data.ventas)) data.ventas = [];
    if (!Number.isFinite(Number(data.seq))) data.seq = 0;
    return data;
  } catch (err) {
    return { seq: 0, ventas: [] };
  }
}

function saveAll(data) {
  ensureDataFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

function nextId() {
  const data = loadAll();
  const id = Number(data.seq || 0) + 1;
  data.seq = id;
  saveAll(data);
  return id;
}

function insertVenta(venta) {
  const data = loadAll();
  const id = Number(data.seq || 0) + 1;
  data.seq = id;
  const payload = { ...venta, ventaId: id };
  data.ventas.push(payload);
  saveAll(data);
  return payload;
}

function updateVenta(ventaId, patch) {
  const data = loadAll();
  const idx = data.ventas.findIndex(v => Number(v.ventaId) === Number(ventaId));
  if (idx < 0) return null;
  data.ventas[idx] = { ...data.ventas[idx], ...patch };
  saveAll(data);
  return data.ventas[idx];
}

function getVenta(ventaId) {
  const data = loadAll();
  return data.ventas.find(v => Number(v.ventaId) === Number(ventaId)) || null;
}

function listVentas(filters = {}) {
  const { from, to, clienteId, estado } = filters;
  const data = loadAll();
  let items = [...data.ventas];
  if (from) {
    const t = new Date(from).getTime();
    if (!Number.isNaN(t)) items = items.filter(v => new Date(v.fecha).getTime() >= t);
  }
  if (to) {
    const t = new Date(to).getTime();
    if (!Number.isNaN(t)) items = items.filter(v => new Date(v.fecha).getTime() <= t);
  }
  if (clienteId != null && clienteId !== '') {
    items = items.filter(v => (v.clienteId ?? null) === (clienteId === 'null' ? null : Number(clienteId)));
  }
  if (estado) {
    const st = String(estado).toLowerCase();
    items = items.filter(v => String(v.estado || '').toLowerCase() === st);
  }
  items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return items;
}

module.exports = {
  nextId,
  insertVenta,
  updateVenta,
  getVenta,
  listVentas,
  FILE_PATH,
};

