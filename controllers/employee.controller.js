const Employee = require('../models/Employee');
const SalaryGrade = require('../models/SalaryGrade');
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
    accountName,
    gradeId
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

  // 2. Handle Salary Grade assignment
  let finalBasic = basicSalary || 0;
  let finalHousing = housingAllowance || 0;
  let finalTransport = transportAllowance || 0;
  let finalOther = otherAllowances || 0;
  let salaryOverridden = false;

  if (gradeId) {
    const grade = await SalaryGrade.findOne({ _id: gradeId, companyId: req.companyId, isActive: true });
    if (!grade) {
      return sendError(res, 'Salary grade not found', 404);
    }

    const hasSalaryInputs =
      basicSalary !== undefined ||
      housingAllowance !== undefined ||
      transportAllowance !== undefined ||
      otherAllowances !== undefined;

    if (hasSalaryInputs) {
      salaryOverridden = true;
    } else {
      finalBasic = grade.basicSalary;
      finalHousing = grade.housingAllowance;
      finalTransport = grade.transportAllowance;
      finalOther = grade.otherAllowances;
      salaryOverridden = false;
    }
  }

  // 3. Create employee
  const employee = await Employee.create({
    companyId: req.companyId,
    firstName,
    lastName,
    email: email ? email.toLowerCase() : undefined,
    phone,
    basicSalary: finalBasic,
    housingAllowance: finalHousing,
    transportAllowance: finalTransport,
    otherAllowances: finalOther,
    bankName,
    accountNumber,
    accountName,
    gradeId: gradeId || undefined,
    salaryOverridden
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

  const employees = await Employee.find(query).populate('gradeId');

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
  }).populate('gradeId');

  if (!employee) {
    return sendError(res, 'Employee not found', 404);
  }

  let gradeData = null;
  let salaryDiffersFromGrade = false;

  if (employee.gradeId) {
    const grade = employee.gradeId;
    gradeData = {
      _id: grade._id,
      name: grade.name,
      basicSalary: grade.basicSalary,
      housingAllowance: grade.housingAllowance,
      transportAllowance: grade.transportAllowance,
      otherAllowances: grade.otherAllowances,
      grossSalary: grade.basicSalary + grade.housingAllowance + grade.transportAllowance + grade.otherAllowances
    };

    salaryDiffersFromGrade =
      employee.basicSalary !== grade.basicSalary ||
      employee.housingAllowance !== grade.housingAllowance ||
      employee.transportAllowance !== grade.transportAllowance ||
      employee.otherAllowances !== grade.otherAllowances;
  }

  const employeeJson = employee.toJSON();
  if (employee.gradeId) {
    employeeJson.gradeId = employee.gradeId._id;
  }

  return sendSuccess(res, 'Employee retrieved successfully', {
    employee: {
      ...employeeJson,
      gradeData,
      salaryDiffersFromGrade
    }
  });
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
    accountName,
    gradeId
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

  // Handle grade update
  if (gradeId !== undefined) {
    if (gradeId === null || gradeId === '') {
      employee.gradeId = undefined;
      employee.salaryOverridden = false;
    } else {
      const grade = await SalaryGrade.findOne({ _id: gradeId, companyId: req.companyId, isActive: true });
      if (!grade) {
        return sendError(res, 'Salary grade not found', 404);
      }

      if (employee.gradeId?.toString() !== gradeId.toString()) {
        employee.gradeId = gradeId;
        
        // If they did not pass manual overrides in this request, inherit grade salary components
        const hasSalaryInputs =
          basicSalary !== undefined ||
          housingAllowance !== undefined ||
          transportAllowance !== undefined ||
          otherAllowances !== undefined;

        if (!hasSalaryInputs) {
          employee.basicSalary = grade.basicSalary;
          employee.housingAllowance = grade.housingAllowance;
          employee.transportAllowance = grade.transportAllowance;
          employee.otherAllowances = grade.otherAllowances;
          employee.salaryOverridden = false;
        }
      }
    }
  }

  // Check if any salary updates are provided to mark as overridden
  const salaryKeys = ['basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances'];
  const hasSalaryUpdates = salaryKeys.some(key => req.body[key] !== undefined);
  if (hasSalaryUpdates) {
    employee.salaryOverridden = true;
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

/**
 * Resets employee salary components back to the assigned SalaryGrade figures.
 */
exports.resetEmployeeSalary = catchAsync(async (req, res) => {
  const employee = await Employee.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!employee) {
    return sendError(res, 'Employee not found', 404);
  }

  if (!employee.gradeId) {
    return sendError(res, 'Employee does not have a salary grade assigned', 400);
  }

  const grade = await SalaryGrade.findOne({
    _id: employee.gradeId,
    companyId: req.companyId,
    isActive: true
  });

  if (!grade) {
    return sendError(res, 'Associated salary grade not found or inactive', 404);
  }

  employee.basicSalary = grade.basicSalary;
  employee.housingAllowance = grade.housingAllowance;
  employee.transportAllowance = grade.transportAllowance;
  employee.otherAllowances = grade.otherAllowances;
  employee.salaryOverridden = false;

  const updatedEmployee = await employee.save();

  return sendSuccess(res, 'Employee salary reset to grade figures successfully', { employee: updatedEmployee });
});
