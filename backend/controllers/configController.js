// controllers/configController.js
const { getParametrosSistema, updateParametrosSistema } = require('../services/configService');

function sanitize(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

async function obtenerParametros(req, res, next) {
  try {
    const data = await getParametrosSistema();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function actualizarParametros(req, res, next) {
  try {
    const {
      nombreEmpresa,
      rucNit,
      direccion,
      monedaSimbolo,
      monedaNombre,
      telefonoSoporte,
      emailSoporte,
      logoPath,
    } = req.body || {};

    if (!nombreEmpresa || !nombreEmpresa.toString().trim()) {
      return res.status(400).json({ message: 'El nombre de la empresa es obligatorio.' });
    }
    if (!monedaSimbolo || !monedaSimbolo.toString().trim()) {
      return res.status(400).json({ message: 'El simbolo de la moneda es obligatorio.' });
    }

    const payload = {
      nombreEmpresa: sanitize(nombreEmpresa).trim(),
      rucNit: sanitize(rucNit).trim(),
      direccion: sanitize(direccion).trim(),
      monedaSimbolo: sanitize(monedaSimbolo).trim(),
      monedaNombre: sanitize(monedaNombre).trim(),
      telefonoSoporte: sanitize(telefonoSoporte).trim(),
      emailSoporte: sanitize(emailSoporte).trim(),
      logoPath: logoPath == null ? null : sanitize(logoPath).trim(),
    };

    const updated = await updateParametrosSistema(payload);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obtenerParametros,
  actualizarParametros,
};

