// services/configService.js
const sql = require('mssql');
const poolPromise = require('../db');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    nombreEmpresa: row.NombreEmpresa || '',
    rucNit: row.RUC_NIT || '',
    direccion: row.Direccion || '',
    monedaSimbolo: row.MonedaSimbolo || '',
    monedaNombre: row.MonedaNombre || '',
    telefonoSoporte: row.TelefonoSoporte || '',
    emailSoporte: row.EmailSoporte || '',
    logoPath: row.LogoPath || null,
  };
}

async function ensureRegistro(pool) {
  const selectResult = await pool
    .request()
    .query('SELECT TOP 1 * FROM dbo.ParametrosSistema ORDER BY ID ASC');

  if (selectResult.recordset.length) {
    return selectResult.recordset[0];
  }

  const insertRequest = pool.request();
  insertRequest.input('NombreEmpresa', sql.NVarChar(250), '');
  insertRequest.input('RUC_NIT', sql.NVarChar(50), null);
  insertRequest.input('Direccion', sql.NVarChar(500), null);
  insertRequest.input('MonedaSimbolo', sql.NVarChar(5), 'RD$');
  insertRequest.input('MonedaNombre', sql.NVarChar(50), null);
  insertRequest.input('TelefonoSoporte', sql.NVarChar(20), null);
  insertRequest.input('EmailSoporte', sql.NVarChar(100), null);
  insertRequest.input('LogoPath', sql.NVarChar(500), null);

  const insertResult = await insertRequest.query(`
    INSERT INTO dbo.ParametrosSistema
      (NombreEmpresa, RUC_NIT, Direccion, MonedaSimbolo, MonedaNombre, TelefonoSoporte, EmailSoporte, LogoPath)
    OUTPUT INSERTED.*
    VALUES (@NombreEmpresa, @RUC_NIT, @Direccion, @MonedaSimbolo, @MonedaNombre, @TelefonoSoporte, @EmailSoporte, @LogoPath);
  `);

  return insertResult.recordset[0];
}

async function getParametrosSistema() {
  const pool = await poolPromise;
  const row = await ensureRegistro(pool);
  return mapRow(row);
}

async function updateParametrosSistema(data) {
  const pool = await poolPromise;
  const current = await ensureRegistro(pool);

  const request = pool.request();
  request.input('ID', sql.Int, current.ID);
  request.input('NombreEmpresa', sql.NVarChar(250), data.nombreEmpresa);
  request.input('RUC_NIT', sql.NVarChar(50), data.rucNit || null);
  request.input('Direccion', sql.NVarChar(500), data.direccion || null);
  request.input('MonedaSimbolo', sql.NVarChar(5), data.monedaSimbolo);
  request.input('MonedaNombre', sql.NVarChar(50), data.monedaNombre || null);
  request.input('TelefonoSoporte', sql.NVarChar(20), data.telefonoSoporte || null);
  request.input('EmailSoporte', sql.NVarChar(100), data.emailSoporte || null);
  request.input('LogoPath', sql.NVarChar(500), data.logoPath || null);

  const updateResult = await request.query(`
    UPDATE dbo.ParametrosSistema
    SET
      NombreEmpresa = @NombreEmpresa,
      RUC_NIT = @RUC_NIT,
      Direccion = @Direccion,
      MonedaSimbolo = @MonedaSimbolo,
      MonedaNombre = @MonedaNombre,
      TelefonoSoporte = @TelefonoSoporte,
      EmailSoporte = @EmailSoporte,
      LogoPath = @LogoPath
    WHERE ID = @ID;

    SELECT TOP 1 * FROM dbo.ParametrosSistema WHERE ID = @ID;
  `);

  return mapRow(updateResult.recordset[0]);
}

module.exports = {
  getParametrosSistema,
  updateParametrosSistema,
};

