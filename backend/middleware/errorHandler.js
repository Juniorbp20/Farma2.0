// middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  // Default to 500
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  // Optionally log the stack in development
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('Error:', err);
  }

  res.status(status).json({ message });
};

