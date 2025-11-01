// backend/store/inventoryUtils.js
// Utilidades compartidas para cálculos de inventario y metadatos de la tabla Lotes.
const sql = require('mssql');
const poolPromise = require('../db');

let lotesColumnInfoCache = null;

async function getLotesColumnInfo(forceRefresh = false) {
  if (!forceRefresh && lotesColumnInfoCache) return lotesColumnInfoCache;
  const pool = await poolPromise;
  const metaQuery = await pool.request().query(`
    SELECT
      CASE WHEN COL_LENGTH('dbo.Lotes','Cantidad') IS NULL THEN 0 ELSE 1 END AS hasCantidad,
      CASE WHEN COL_LENGTH('dbo.Lotes','CantidadEmpaques') IS NULL THEN 0 ELSE 1 END AS hasCantidadEmpaques,
      CASE WHEN COL_LENGTH('dbo.Lotes','CantidadUnidadesMinimas') IS NULL THEN 0 ELSE 1 END AS hasCantidadUnidades,
      CASE WHEN COL_LENGTH('dbo.Lotes','MotivoInactivacion') IS NULL THEN 0 ELSE 1 END AS hasMotivoInactivacion
  `);
  const row = metaQuery.recordset[0] || {};
  lotesColumnInfoCache = {
    hasCantidad: Boolean(row.hasCantidad),
    hasCantidadEmpaques: Boolean(row.hasCantidadEmpaques),
    hasCantidadUnidades: Boolean(row.hasCantidadUnidades),
    hasMotivoInactivacion: Boolean(row.hasMotivoInactivacion),
  };
  return lotesColumnInfoCache;
}

function resetLotesColumnInfoCache() {
  lotesColumnInfoCache = null;
}

function ensurePositiveNumber(value, fallback = 0) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return num;
  return fallback;
}

function parseDecimal(value, fractionDigits = 2, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const factor = Math.pow(10, fractionDigits);
  return Math.round(num * factor) / factor;
}

function getCantidadExpressions(meta, options = {}) {
  const { alias = 'l', productAlias = 'p' } = options;
  const factorExpr = `CASE WHEN COALESCE(${productAlias}.CantidadUnidadMinimaXEmpaque,0)=0 THEN 1 ELSE ${productAlias}.CantidadUnidadMinimaXEmpaque END`;
  const empaquesExpr = meta.hasCantidadEmpaques ? `COALESCE(${alias}.CantidadEmpaques,0)` : '0';
  const unidadesExpr = meta.hasCantidadUnidades ? `COALESCE(${alias}.CantidadUnidadesMinimas,0)` : '0';
  const cantidadExpr = meta.hasCantidad
    ? `COALESCE(${alias}.Cantidad,0)`
    : `(${empaquesExpr} * ${factorExpr}) + ${unidadesExpr}`;
  return { factorExpr, empaquesExpr, unidadesExpr, cantidadExpr };
}

function computeUnitsFromCounts({ empaques = 0, unidades = 0, cantidad = 0 }, factor = 1, meta = {}) {
  const safeFactor = factor && Number.isFinite(Number(factor)) && Number(factor) > 0 ? Number(factor) : 1;
  if (meta.hasCantidad && Number.isFinite(Number(cantidad))) {
    return ensurePositiveNumber(cantidad, 0);
  }
  const empaquesUnits = ensurePositiveNumber(empaques, 0) * safeFactor;
  return empaquesUnits + ensurePositiveNumber(unidades, 0);
}

function splitUnitsToCounts(totalUnits, factor = 1, meta = {}) {
  const safeFactor = factor && Number.isFinite(Number(factor)) && Number(factor) > 0 ? Number(factor) : 1;
  const units = Math.max(0, Number.isFinite(Number(totalUnits)) ? Number(totalUnits) : 0);
  if (meta.hasCantidad && !meta.hasCantidadEmpaques && !meta.hasCantidadUnidades) {
    return { cantidad: units, empaques: 0, unidades: 0 };
  }
  const empaques = Math.floor(units / safeFactor);
  const unidades = units - (empaques * safeFactor);
  const result = {
    empaques,
    unidades,
  };
  if (meta.hasCantidad) result.cantidad = units;
  return result;
}

module.exports = {
  getLotesColumnInfo,
  resetLotesColumnInfoCache,
  getCantidadExpressions,
  computeUnitsFromCounts,
  splitUnitsToCounts,
  ensurePositiveNumber,
  parseDecimal,
};
