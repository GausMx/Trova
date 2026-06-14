const express = require('express');
const { body } = require('express-validator');
const payrollController = require('../controllers/payroll.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);

// Validation rules for computing payroll
const computeValidationRules = [
  body('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be an integer between 1 and 12'),
  body('year')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Please supply a valid calculation year')
];

// GET / -> List payroll history (excluding heavy sub-employee data)
router.get('/', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getPayrollRuns);

// POST /compute -> Calculate draft run (Owner, Admin, and Finance only)
router.post('/compute', restrictTo('owner', 'admin', 'finance'), computeValidationRules, validate, payrollController.computePayroll);

// GET /:id -> Get payroll run details with full employee sub-records
router.get('/:id', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getPayrollRunById);

// POST /:id/approve -> Approve draft payroll (Owner, Admin, and Finance only)
router.post('/:id/approve', restrictTo('owner', 'admin', 'finance'), payrollController.approvePayroll);

// POST /:id/pay -> Process run payments (Owner and Finance only)
router.post('/:id/pay', restrictTo('owner', 'finance'), payrollController.payPayroll);

// GET /:id/payslip/:employeeId -> Stream/download PDF payslip (Owner, Admin, HR, and Finance allowed)
router.get('/:id/payslip/:employeeId', restrictTo('owner', 'admin', 'hr', 'finance'), payrollController.getPayslip);

module.exports = router;
