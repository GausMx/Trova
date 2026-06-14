const Employee = require('../models/Employee');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { EMPLOYEE_STATUS } = require('../config/constants');

/**
 * Creates a new Employee for the company.
 * Automatically scopes companyId and generates staffId via model pre-save hook.
 */
exports.createEmployee = catchAsync(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    bankName,
    accountNumber,
    accountName
  } = req.body;

  // 1. If email is provided, prevent duplicates within the same company tenant
  if (email) {
    const duplicate = await Employee.findOne({
      companyId: req.companyId,
      email: email.toLowerCase()
    });
    if (duplicate) {
      return sendError(res, 'An employee with this email already exists in your company', 400);
    }
  }

  // 2. Create employee
  const employee = await Employee.create({
    companyId: req.companyId,
    firstName,
    lastName,
    email: email ? email.toLowerCase() : undefined,
    phone,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    bankName,
    accountNumber,
    accountName
  });

  return sendSuccess(res, 'Employee created successfully', { employee }, 201);
});

/**
 * Retrieves all employees for the company.
 * Supports status filtering (defaults to active).
 */
exports.getEmployees = catchAsync(async (req, res) => {
  const { status } = req.query;
  
  // Build query scoped strictly to companyId
  const query = { companyId: req.companyId };
  
  // If status filter is passed, apply it, otherwise default to active
  if (status) {
    query.status = status;
  } else {
    query.status = EMPLOYEE_STATUS.ACTIVE;
  }

  const employees = await Employee.find(query);

  return sendSuccess(res, 'Employees retrieved successfully', { employees });
});

/**
 * Retrieves details for a specific employee by ID.
 * Enforces companyId isolation.
 */
exports.getEmployeeById = catchAsync(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!employee) {
    return sendError(res, 'Employee not found', 404);
  }

  return sendSuccess(res, 'Employee retrieved successfully', { employee });
});

/**
 * Updates an employee's details.
 * Enforces companyId isolation.
 */
exports.updateEmployee = catchAsync(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!employee) {
    return sendError(res, 'Employee not found', 404);
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    status,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    bankName,
    accountNumber,
    accountName
  } = req.body;

  // Verify unique email check if updated
  if (email && email.toLowerCase() !== employee.email) {
    const duplicate = await Employee.findOne({
      companyId: req.companyId,
      email: email.toLowerCase()
    });
    if (duplicate) {
      return sendError(res, 'An employee with this email already exists in your company', 400);
    }
    employee.email = email.toLowerCase();
  }

  // Update provided fields
  if (firstName !== undefined) employee.firstName = firstName;
  if (lastName !== undefined) employee.lastName = lastName;
  if (phone !== undefined) employee.phone = phone;
  if (status !== undefined) employee.status = status;
  if (basicSalary !== undefined) employee.basicSalary = basicSalary;
  if (housingAllowance !== undefined) employee.housingAllowance = housingAllowance;
  if (transportAllowance !== undefined) employee.transportAllowance = transportAllowance;
  if (otherAllowances !== undefined) employee.otherAllowances = otherAllowances;
  if (bankName !== undefined) employee.bankName = bankName;
  if (accountNumber !== undefined) employee.accountNumber = accountNumber;
  if (accountName !== undefined) employee.accountName = accountName;

  const updatedEmployee = await employee.save();

  return sendSuccess(res, 'Employee updated successfully', { employee: updatedEmployee });
});

/**
 * Soft deletes an employee by setting status to 'terminated'.
 * Enforces companyId isolation and prevents orphaned payroll records.
 */
exports.deleteEmployee = catchAsync(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!employee) {
    return sendError(res, 'Employee not found', 404);
  }

  if (employee.status === EMPLOYEE_STATUS.TERMINATED) {
    return sendError(res, 'Employee is already terminated', 400);
  }

  employee.status = EMPLOYEE_STATUS.TERMINATED;
  await employee.save();

  return sendSuccess(res, 'Employee soft-deleted (status marked as terminated) successfully', {
    employeeId: employee._id,
    status: employee.status
  });
});
