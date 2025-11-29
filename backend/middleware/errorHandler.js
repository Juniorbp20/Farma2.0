// middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }

  res.status(status).json({ message });
};

