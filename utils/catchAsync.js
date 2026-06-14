/**
 * Wraps asynchronous route handlers to automatically catch errors and forward them to the global error middleware.
 * @param {Function} fn - Asynchronous route handler/middleware
 * @returns {Function} Express middleware function
 */
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
