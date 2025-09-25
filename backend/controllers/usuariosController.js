// controllers/usuariosController.js
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const poolPromise = require('../db');

const selectBase = `
  SELECT u.UsuarioID, u.Nombres, u.Apellidos, u.Username, u.Email, u.Telefono,
         u.RolID, r.NombreRol, u.Activo, u.FechaCreacion, u.UltimoAcceso
  FROM dbo.Usuarios u
  LEFT JOIN dbo.Roles r ON r.RolID = u.RolID
`;

async function getUsuarios(req, res) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(selectBase + ' ORDER BY u.UsuarioID');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error listando usuarios:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function getUsuarioById(req, res) {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('UsuarioID', sql.Int, id)
      .query(selectBase + ' WHERE u.UsuarioID = @UsuarioID');
    if (!result.recordset.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error obteniendo usuario:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function createUsuario(req, res) {
  const { Nombres, Apellidos, Username, Password, Email, Telefono, RolID, Activo = true } = req.body;
  if (!Nombres || !Apellidos || !Username || !Password || !RolID) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }
  try {
    const pool = await poolPromise;
    // Verificar duplicado
    const dup = await pool
      .request()
      .input('Username', sql.NVarChar(50), Username)
      .query('SELECT TOP 1 UsuarioID FROM dbo.Usuarios WHERE LOWER(LTRIM(RTRIM(Username))) = LOWER(LTRIM(RTRIM(@Username)))');
    if (dup.recordset.length) return res.status(400).json({ message: 'Ya existe un usuario con ese username' });

    const hash = await bcrypt.hash(Password, 10);
    await pool
      .request()
      .input('Nombres', sql.NVarChar(100), Nombres)
      .input('Apellidos', sql.NVarChar(100), Apellidos)
      .input('Username', sql.NVarChar(50), Username)
      .input('PasswordUser', sql.NVarChar(255), hash)
      .input('Email', sql.NVarChar(150), Email || null)
      .input('Telefono', sql.NVarChar(50), Telefono || null)
      .input('RolID', sql.Int, RolID)
      .input('Activo', sql.Bit, Activo ? 1 : 0)
      .query(`
        INSERT INTO dbo.Usuarios (Nombres, Apellidos, Username, PasswordUser, Email, Telefono, RolID, Activo)
        VALUES (@Nombres, @Apellidos, @Username, @PasswordUser, @Email, @Telefono, @RolID, @Activo)
      `);
    res.status(201).json({ message: 'Usuario creado con éxito' });
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function updateUsuario(req, res) {
  const { id } = req.params;
  const { Nombres, Apellidos, Username, Password, Email, Telefono, RolID, Activo } = req.body;
  try {
    const pool = await poolPromise;
    // Si se cambia Username, verificar duplicado
    if (Username) {
      const dup = await pool
        .request()
        .input('UsuarioID', sql.Int, id)
        .input('Username', sql.NVarChar(50), Username)
        .query(`
          SELECT TOP 1 UsuarioID FROM dbo.Usuarios
          WHERE LOWER(LTRIM(RTRIM(Username))) = LOWER(LTRIM(RTRIM(@Username))) AND UsuarioID <> @UsuarioID
        `);
      if (dup.recordset.length) return res.status(400).json({ message: 'Ya existe un usuario con ese username' });
    }

    const reqq = pool.request()
      .input('UsuarioID', sql.Int, id)
      .input('Nombres', sql.NVarChar(100), Nombres || null)
      .input('Apellidos', sql.NVarChar(100), Apellidos || null)
      .input('Username', sql.NVarChar(50), Username || null)
      .input('Email', sql.NVarChar(150), Email || null)
      .input('Telefono', sql.NVarChar(50), Telefono || null)
      .input('RolID', sql.Int, RolID || null)
      .input('Activo', sql.Bit, typeof Activo === 'boolean' ? (Activo ? 1 : 0) : null);

    let sqlUpdate = `UPDATE dbo.Usuarios SET 
      Nombres = COALESCE(@Nombres, Nombres),
      Apellidos = COALESCE(@Apellidos, Apellidos),
      Username = COALESCE(@Username, Username),
      Email = COALESCE(@Email, Email),
      Telefono = COALESCE(@Telefono, Telefono),
      RolID = COALESCE(@RolID, RolID)`;
    if (typeof Activo === 'boolean') sqlUpdate += `, Activo = COALESCE(@Activo, Activo)`;

    if (Password) {
      const hash = await bcrypt.hash(Password, 10);
      reqq.input('PasswordUser', sql.NVarChar(255), hash);
      sqlUpdate += `, PasswordUser = COALESCE(@PasswordUser, PasswordUser)`;
    }
    sqlUpdate += ` WHERE UsuarioID = @UsuarioID`;

    const result = await reqq.query(sqlUpdate);
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ message: 'Usuario actualizado' });
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

async function deleteUsuario(req, res) {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('UsuarioID', sql.Int, id)
      .query('UPDATE dbo.Usuarios SET Activo = 0 WHERE UsuarioID = @UsuarioID');
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    console.error('Error desactivando usuario:', err);
    res.status(500).json({ message: 'Error en la base de datos' });
  }
}

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
};

