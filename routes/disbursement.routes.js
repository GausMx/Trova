const express = require('express');
const router = express.Router();
const disbursementController = require('../controllers/disbursement.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roles.middleware');

// Public Webhook Listener Endpoint for Remita Notifications
router.post('/webhook', disbursementController.processRemitaWebhook);

// Protected routes below
router.use(protect);

router.get(
  '/payroll/:payrollRunId/summary',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.getDisbursementSummary
);

router.post(
  '/payroll/:payrollRunId/generate-rrr',
  restrictTo('owner', 'admin', 'finance'),
  disbursementController.generateRRR
);

router.get(
  '/payroll/:payrollRunId/status',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.getDisbursementStatus
);

// Compliance Schedule Auto-Generator Downloads
router.get(
  '/payroll/:payrollRunId/schedules/taxpro-max',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.downloadTaxProMaxSchedule
);

router.get(
  '/payroll/:payrollRunId/schedules/pencom',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.downloadPenComSchedule
);

router.get(
  '/payroll/:payrollRunId/schedules/nsitf',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.downloadNsitfSchedule
);

router.get(
  '/payroll/:payrollRunId/schedules/nhf',
  restrictTo('owner', 'admin', 'hr', 'finance'),
  disbursementController.downloadNhfSchedule
);

module.exports = router;
