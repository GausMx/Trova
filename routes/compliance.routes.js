const express = require('express');
const complianceController = require('../controllers/compliance.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus } = require('../middleware/roles.middleware');

const router = express.Router();

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);

// GET /api/compliance/calendar -> Get upcoming deadlines for the next 30 days
router.get(
  '/calendar',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  complianceController.getUpcomingDeadlines
);

// GET /api/compliance/summary -> Get obligation summary for current calendar month
router.get(
  '/summary',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  complianceController.getComplianceSummary
);

module.exports = router;
