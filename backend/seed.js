// seed.js
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const poolPromise = require('./db');

async function columnExists(pool, table, column) {
  const res = await pool
    .request()
    .input('table', sql.NVarChar(128), table)
    .input('column', sql.NVarChar(128), column)
    .query(`SELECT 1 AS existsCol FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @table AND COLUMN_NAME = @column`);
  return res.recordset.length > 0;
}

async function seedAdmin() {
  try {
    const pool = await poolPromise;

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const canReset = process.env.SEED_RESET_ADMIN === 'true' || process.env.NODE_ENV !== 'production';

    // Detectar columnas según el esquema existente
    const hasPasswordUser = await columnExists(pool, 'Usuarios', 'PasswordUser');
    const hasPasswordHash = await columnExists(pool, 'Usuarios', 'PasswordHash');
    const passCol = hasPasswordUser ? 'PasswordUser' : (hasPasswordHash ? 'PasswordHash' : null);
    if (!passCol) {
      console.warn('Seed: no se encontró columna de contraseña en Usuarios (PasswordUser/PasswordHash).');
      return;
    }

    const hasRolId = await columnExists(pool, 'Usuarios', 'RolID');
    const hasRol = await columnExists(pool, 'Usuarios', 'Rol');

    const existing = await pool
      .request()
      .input('Username', sql.NVarChar(50), adminUser)
      .query('SELECT TOP 1 UsuarioID FROM Usuarios WHERE Username = @Username');

    if (!existing.recordset.length) {
      // Si no existe, intentar crearlo solo con campos mínimos conocidos
      const hash = await bcrypt.hash(adminPass, 10);
      const req = pool.request()
        .input('Username', sql.NVarChar(50), adminUser)
        .input('Password', sql.NVarChar(255), hash);
      let insertSql = `INSERT INTO Usuarios (Username, ${passCol}`;
      if (hasRolId) { insertSql += `, RolID`; }
      else if (hasRol) { insertSql += `, Rol`; }
      insertSql += `) VALUES (@Username, @Password`;
      if (hasRolId) { insertSql += `, 1`; }
      else if (hasRol) { insertSql += `, 'admin'`; }
      insertSql += `)`;
      await req.query(insertSql);
      console.log(`Admin creado: usuario="${adminUser}"`);
    } else if (canReset && adminPass) {
      const hash = await bcrypt.hash(adminPass, 10);
      await pool
        .request()
        .input('Username', sql.NVarChar(50), adminUser)
        .input('Password', sql.NVarChar(255), hash)
        .query(`UPDATE Usuarios SET ${passCol} = @Password WHERE Username = @Username`);
      console.log('Password de admin actualizado por seed.');
    }
  } catch (err) {
    console.error('Error en seedAdmin:', err.message);
  }
}

module.exports = { seedAdmin };
