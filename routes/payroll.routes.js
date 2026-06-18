const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const payrollController = require('../controllers/payroll.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus, checkSubscriptionLimits, checkFeatureAccess, checkSubscriptionActive } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);
router.use(checkSubscriptionActive);

// Validation rules for computing payroll
const computeValidationRules = [
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be an integer between 1 and 12'),
  body('year')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Please supply a valid calculation year'),
  body('attendance')
    .optional()
    .isArray()
    .withMessage('Attendance must be an array'),
  body('attendance.*.employeeId')
    .optional()
    .isMongoId()
    .withMessage('employeeId must be a valid Mongo ID'),
  body('attendance.*.daysAbsent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('daysAbsent must be a non-negative number'),
  body('attendance.*.halfDays')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('halfDays must be a non-negative number')
];

// Validation rules for updating attendance manually
const attendanceValidationRules = [
  body('attendance')
    .isArray()
    .withMessage('Attendance must be an array of objects'),
  body('attendance.*.employeeId')
    .isMongoId()
    .withMessage('employeeId must be a valid Mongo ID'),
  body('attendance.*.daysAbsent')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('daysAbsent must be a non-negative number'),
  body('attendance.*.halfDays')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('halfDays must be a non-negative number')
];

// GET / -> List payroll history
router.get('/', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getPayrollRuns);

// POST /compute -> Calculate draft run (Owner, Admin, and Finance only)
router.post('/compute', restrictTo('owner', 'admin', 'finance'), checkSubscriptionLimits, computeValidationRules, validate, payrollController.computePayroll);

// GET /:id -> Get payroll run details with full employee sub-records
router.get('/:id', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getPayrollRunById);

// POST /:id/approve -> Approve draft payroll (Owner, Admin, and Finance only)
router.post('/:id/approve', restrictTo('owner', 'admin', 'finance'), checkSubscriptionLimits, payrollController.approvePayroll);

// POST /:id/pay -> Process run payments (Owner and Finance only)
router.post('/:id/pay', restrictTo('owner', 'finance'), checkSubscriptionLimits, payrollController.payPayroll);

// GET /:id/payslip/:employeeId -> Stream/download PDF payslip
router.get('/:id/payslip/:employeeId', restrictTo('owner', 'admin', 'hr', 'finance'), checkFeatureAccess('pdf_payslips'), payrollController.getPayslip);

// POST /:id/attendance -> Update attendance for a DRAFT run (Owner, Admin, and Finance only)
router.post('/:id/attendance', restrictTo('owner', 'admin', 'finance'), checkFeatureAccess('attendance_proration'), checkSubscriptionLimits, attendanceValidationRules, validate, payrollController.updateAttendance);

// GET /:id/attendance-sheet -> Retrieve attendance sheet overview (Owner, Admin, HR, and Finance only)
router.get('/:id/attendance-sheet', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getAttendanceSheet);

// POST /:id/attendance/upload -> Bulk CSV upload for attendance (Owner, Admin, and Finance only)
router.post('/:id/attendance/upload', restrictTo('owner', 'admin', 'finance'), checkFeatureAccess('attendance_proration'), checkSubscriptionLimits, upload.single('file'), payrollController.uploadAttendanceCsv);

// GET /:id/payment-file/csv -> Download CSV payment file (Owner, Admin, and Finance only)
router.get('/:id/payment-file/csv', restrictTo('owner', 'admin', 'finance'), checkFeatureAccess('bulk_payment_file'), payrollController.getPaymentFileCsv);

// GET /:id/payment-file/excel -> Download Excel payment file (Owner, Admin, and Finance only)
router.get('/:id/payment-file/excel', restrictTo('owner', 'admin', 'finance'), checkFeatureAccess('bulk_payment_file'), payrollController.getPaymentFileExcel);

module.exports = router;
