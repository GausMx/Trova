const express = require('express');
const { body } = require('express-validator');
const companyController = require('../controllers/company.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);

// GET /api/companies/me -> Get current company profile
router.get('/me', companyController.getCompanyProfile);

// PUT /api/companies/me -> Update company profile (Owner and Admin only)
router.put(
  '/me',
  restrictTo('owner', 'admin'),
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Company name cannot be empty'),
    body('industry')
      .optional()
      .trim(),
    body('address')
      .optional()
      .trim()
  ],
  validate,
  companyController.updateCompanyProfile
);

module.exports = router;
