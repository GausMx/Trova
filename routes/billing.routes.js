const express = require('express');
const { body } = require('express-validator');
const billingController = require('../controllers/billing.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');
const { SUBSCRIPTION_TIERS } = require('../config/constants');

const router = express.Router();

// 1. PUBLIC WEBHOOK ROUTE (Authentication is verified inside the handler using HMAC SHA512 signature)
router.post('/webhook', billingController.handleWebhook);

// Apply base protection and company status checking middleware to all administrative routes
router.use(protect);
router.use(checkCompanyStatus);

// POST /initialize -> Initialize checkout (Owner only)
router.post(
  '/initialize',
  restrictTo('owner'),
  [
    body('tier')
      .isIn([SUBSCRIPTION_TIERS.STARTER, SUBSCRIPTION_TIERS.GROWTH, SUBSCRIPTION_TIERS.ENTERPRISE])
      .withMessage('Please select a valid paid subscription tier')
  ],
  validate,
  billingController.initializeSubscription
);

// GET /status -> Get current subscription details (Owner and Admin only)
router.get(
  '/status',
  restrictTo('owner', 'admin'),
  billingController.getBillingStatus
);

// GET /verify/:reference -> Verify and activate payment (Owner and Admin only)
router.get(
  '/verify/:reference',
  restrictTo('owner', 'admin'),
  billingController.verifySubscription
);

module.exports = router;
