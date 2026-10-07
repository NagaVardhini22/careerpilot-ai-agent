/**
 * Centralized Error Handling Middleware
 */

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] [${req.method} ${req.originalUrl}] - ${message}`);
  if (statusCode === 500 && process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
    path: req.originalUrl
  });
}

module.exports = errorHandler;
