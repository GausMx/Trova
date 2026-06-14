const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { USER_ROLES } = require('../config/constants');

/**
 * Generates a JWT token for the user.
 * @param {Object} user - User document
 * @returns {string} Signed JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, companyId: user.companyId, role: user.role },
    process.env.JWT_SECRET || 'super_secret_trova_access_token_12345!',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'super_secret_trova_refresh_token_67890!',
    { expiresIn: '7d' }
  );
};

/**
 * Registers a new Company and its primary Owner User.
 * Employs sequential creation with manual rollback to guarantee standalone MongoDB compatibility.
 */
exports.register = catchAsync(async (req, res, next) => {
  const { companyName, industry, firstName, lastName, email, password, role } = req.body;

  const targetRole = role || USER_ROLES.OWNER;

  // 1. Check if email is already registered
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return sendError(res, 'Email address is already registered', 400);
  }

  let company;

  if (targetRole === USER_ROLES.OWNER) {
    // Owner registration: Verify company doesn't exist and create a new one
    const existingCompany = await Company.findOne({ name: companyName });
    if (existingCompany) {
      return sendError(res, 'Company name is already registered', 400);
    }

    company = await Company.create({
      name: companyName,
      industry
    });
  } else {
    // Non-owner registration: Find existing company by name
    company = await Company.findOne({ name: companyName });
    if (!company) {
      return sendError(res, 'Company not found. Please register as an Owner first to create the company.', 404);
    }
  }

  // 2. Create the User linked to the company
  try {
    const user = await User.create({
      companyId: company._id,
      firstName,
      lastName,
      email,
      password,
      role: targetRole
    });

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Sanitize user object for response (remove password hash)
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return sendSuccess(res, 'User registered successfully', {
      token,
      refreshToken,
      user: sanitizedUser,
      company
    }, 201);
  } catch (error) {
    // Rollback company creation if user creation fails (only for new company/owner registrations)
    if (targetRole === USER_ROLES.OWNER && company) {
      await Company.findByIdAndDelete(company._id);
    }
    return next(error);
  }
});

/**
 * Authenticates a User and returns a JWT access token.
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Fetch user by email including the password field
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 'Invalid email or password', 401);
  }

  if (!user.isActive) {
    return sendError(res, 'Account is inactive. Please contact system admin.', 401);
  }

  // 2. Generate token and return success
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  return sendSuccess(res, 'Login successful', {
    token,
    refreshToken,
    user: sanitizedUser
  });
});

/**
 * Gets details of the currently authenticated User.
 */
exports.getMe = catchAsync(async (req, res) => {
  const sanitizedUser = req.user.toObject();
  delete sanitizedUser.password;

  return sendSuccess(res, 'Current user retrieved successfully', {
    user: sanitizedUser
  });
});

/**
 * Refreshes the JWT access token using a valid refresh token.
 */
exports.refresh = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendError(res, 'Refresh token is required', 400);
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'super_secret_trova_refresh_token_67890!'
    );

    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 'The user belonging to this token no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'User account is inactive.', 401);
    }

    const newAccessToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return sendSuccess(res, 'Tokens refreshed successfully', {
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    return sendError(res, 'Invalid or expired refresh token. Please log in again.', 401);
  }
});
