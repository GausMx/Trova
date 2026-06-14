/**
 * Standard API response utility for consistent client payloads.
 */

/**
 * Sends a successful response.
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Object|Array} data - Data to send to client
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Sends an error response.
 * @param {Object} res - Express response object
 * @param {string} message - Error description
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {any} errors - Detailed errors (e.g., validation arrays)
 */
const sendError = (res, message, statusCode = 500, errors = null) => {
  const payload = {
    success: false,
    message
  };

  if (errors) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError
};
