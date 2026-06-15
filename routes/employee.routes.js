const express = require('express');
const { body } = require('express-validator');
const employeeController = require('../controllers/employee.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply base protection and company status checking middleware to all routes
router.use(protect);
router.use(checkCompanyStatus);

// Validation rules
const employeeValidationRules = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim(),
  body('basicSalary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Basic salary must be a positive number'),
  body('housingAllowance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Housing allowance must be a positive number'),
  body('transportAllowance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Transport allowance must be a positive number'),
  body('otherAllowances')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Other allowances must be a positive number'),
  body('bankName')
    .optional()
    .trim(),
  body('accountNumber')
    .optional({ checkFalsy: true })
    .isLength({ min: 10, max: 10 })
    .isNumeric()
    .withMessage('Account number must be a 10-digit Nigerian NUBAN number'),
  body('accountName')
    .optional()
    .trim(),
  body('gradeId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid salary grade ID format')
];

const employeeUpdateValidationRules = [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Please enter a valid email address'),
  body('basicSalary').optional().isFloat({ min: 0 }).withMessage('Basic salary must be a positive number'),
  body('housingAllowance').optional().isFloat({ min: 0 }).withMessage('Housing allowance must be a positive number'),
  body('transportAllowance').optional().isFloat({ min: 0 }).withMessage('Transport allowance must be a positive number'),
  body('otherAllowances').optional().isFloat({ min: 0 }).withMessage('Other allowances must be a positive number'),
  body('accountNumber').optional({ checkFalsy: true }).isLength({ min: 10, max: 10 }).isNumeric().withMessage('Account number must be a 10-digit Nigerian NUBAN number'),
  body('gradeId').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid salary grade ID format')
];

// GET / -> List employees
router.get('/', restrictTo('owner', 'admin', 'hr', 'finance'), employeeController.getEmployees);

// POST / -> Create employee (Owner, Admin, and HR only)
router.post('/', restrictTo('owner', 'admin', 'hr'), employeeValidationRules, validate, employeeController.createEmployee);

// GET /:id -> Get single employee detail
router.get('/:id', restrictTo('owner', 'admin', 'hr', 'finance'), employeeController.getEmployeeById);

// PUT /:id -> Update employee details (Owner, Admin, and HR only)
router.put('/:id', restrictTo('owner', 'admin', 'hr'), employeeUpdateValidationRules, validate, employeeController.updateEmployee);

// PUT /:id/reset-salary -> Reset employee salary to grade defaults (Owner, Admin, and HR only)
router.put('/:id/reset-salary', restrictTo('owner', 'admin', 'hr'), employeeController.resetEmployeeSalary);

// DELETE /:id -> Soft delete employee (Owner, Admin, and HR only)
router.delete('/:id', restrictTo('owner', 'admin', 'hr'), employeeController.deleteEmployee);

module.exports = router;
