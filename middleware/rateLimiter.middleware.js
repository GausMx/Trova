const rateLimit = require('express-rate-limit');

/**
 * Rate limiter middleware specifically for sensitive endpoints (register, login).
 * Limits IP addresses to 10 requests per 15 minutes. Disabled in test environment.
 */
const authLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 10,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      }
    });

module.exports = authLimiter;
