const jwt = require('jsonwebtoken');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { sendError } = require('../utils/responseHandler');

/**
 * Authentication middleware to protect API routes.
 * Verifies JWT signature, retrieves user, and injects tenant scope variables.
 */
const protect = catchAsync(async (req, res, next) => {
  let token;

  // Extract Bearer token from authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 'Authentication required. Please log in.', 401);
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_trova_access_token_12345!');

    // Fetch user and ensure they still exist and are active
    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 'The user belonging to this token no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'User account is inactive. Please contact your administrator.', 401);
    }

    // Attach user information to request context
    req.user = user;
    req.companyId = user.companyId;

    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired session. Please log in again.', 401);
  }
});

module.exports = { protect };
