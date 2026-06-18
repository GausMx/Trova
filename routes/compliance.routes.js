const express = require('express');
const complianceController = require('../controllers/compliance.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus, checkFeatureAccess, checkSubscriptionActive } = require('../middleware/roles.middleware');

const router = express.Router();

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);
router.use(checkSubscriptionActive);
router.use(checkFeatureAccess('compliance_calendar'));

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

// GET /api/compliance/records -> Get compliance records scoped by companyId
router.get(
  '/records',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  complianceController.getComplianceRecords
);

// PATCH /api/compliance/records/:id/complete -> Mark obligation as completed
router.patch(
  '/records/:id/complete',
  restrictTo('owner', 'admin', 'finance'),
  complianceController.completeComplianceRecord
);

module.exports = router;
