const rateLimit = require('express-rate-limit');

let store;

// Initialize Redis store in production/development if REDIS_URL is provided
if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
  try {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');

    const client = createClient({ url: process.env.REDIS_URL });
    client.connect().catch((err) => {
      console.error('Redis connection error in rate limiter store:', err.message);
    });

    store = new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
    });
    console.log('✔ Scalable Redis Rate Limiter Store initialized successfully.');
  } catch (err) {
    console.warn('Unable to initialize Redis client for rate limiting, falling back to MemoryStore:', err.message);
  }
}

/**
 * Helper to build rate limiter options with optional Redis store backing.
 */
const createLimiter = (options) => {
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }

  const limiterConfig = {
    ...options,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  };

  if (store) {
    limiterConfig.store = store;
  }

  return rateLimit(limiterConfig);
};

// Limiter for authentication endpoints (register, login)
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Global API limiter
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter
};
