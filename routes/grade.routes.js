const express = require('express');
const { body } = require('express-validator');
const gradeController = require('../controllers/grade.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkCompanyStatus, checkFeatureAccess, checkSubscriptionActive } = require('../middleware/roles.middleware');
const validate = require('../middleware/validate.middleware');

const router = express.Router();

// Apply auth protection and company active check to all grade routes
router.use(protect);
router.use(checkCompanyStatus);
router.use(checkSubscriptionActive);
router.use(checkFeatureAccess('salary_grades'));

const gradeValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Salary grade name is required'),
  body('level')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Level must be a positive integer'),
  body('basicSalary')
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
  body('description')
    .optional()
    .trim()
];

const gradeUpdateValidationRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Salary grade name cannot be empty'),
  body('level')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Level must be a positive integer'),
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
  body('description')
    .optional()
    .trim()
];

// GET / -> List active salary grades for the company
router.get('/', restrictTo('owner', 'admin', 'hr', 'finance'), gradeController.getGrades);

// POST / -> Create a salary grade (Owner, Admin, and HR only)
router.post('/', restrictTo('owner', 'admin', 'hr'), gradeValidationRules, validate, gradeController.createGrade);

// GET /:id -> Get salary grade details
router.get('/:id', restrictTo('owner', 'admin', 'hr', 'finance'), gradeController.getGradeById);

// PUT /:id -> Update salary grade details (Owner, Admin, and HR only)
router.put('/:id', restrictTo('owner', 'admin', 'hr'), gradeUpdateValidationRules, validate, gradeController.updateGrade);

// DELETE /:id -> Soft delete salary grade (Owner, Admin, and HR only)
router.delete('/:id', restrictTo('owner', 'admin', 'hr'), gradeController.deleteGrade);

module.exports = router;
