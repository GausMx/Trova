const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter.middleware');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Register Route
router.post(
  '/register',
  authLimiter,
  [
    body('companyName')
      .trim()
      .notEmpty()
      .withMessage('Company name is required'),
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required'),
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .optional()
      .isIn(['owner', 'admin', 'hr', 'finance'])
      .withMessage('Please specify a valid company role')
  ],
  validate,
  authController.register
);

// Login Route
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  validate,
  authController.login
);

// Refresh Token Route
router.post('/refresh', authController.refresh);

// Get Current User Profile (Protected)
router.get('/me', protect, authController.getMe);

module.exports = router;
