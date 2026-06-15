const SalaryGrade = require('../models/SalaryGrade');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Lists all active salary grades for the company tenant.
 */
exports.getGrades = catchAsync(async (req, res) => {
  const grades = await SalaryGrade.find({
    companyId: req.companyId,
    isActive: true
  }).sort({ level: 1, name: 1 });

  return sendSuccess(res, 'Salary grades retrieved successfully', { grades });
});

/**
 * Creates a new salary grade.
 */
exports.createGrade = catchAsync(async (req, res) => {
  const {
    name,
    level,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    description
  } = req.body;

  // Check for duplicate names within the same tenant company
  const duplicate = await SalaryGrade.findOne({
    companyId: req.companyId,
    name: name.trim(),
    isActive: true
  });

  if (duplicate) {
    return sendError(res, 'A salary grade with this name already exists', 400);
  }

  const grade = await SalaryGrade.create({
    companyId: req.companyId,
    name: name.trim(),
    level,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    description
  });

  return sendSuccess(res, 'Salary grade created successfully', { grade }, 201);
});

/**
 * Retrieves details of a single salary grade.
 */
exports.getGradeById = catchAsync(async (req, res) => {
  const grade = await SalaryGrade.findOne({
    _id: req.params.id,
    companyId: req.companyId,
    isActive: true
  });

  if (!grade) {
    return sendError(res, 'Salary grade not found', 404);
  }

  return sendSuccess(res, 'Salary grade details retrieved successfully', { grade });
});

/**
 * Updates an existing salary grade.
 */
exports.updateGrade = catchAsync(async (req, res) => {
  const {
    name,
    level,
    basicSalary,
    housingAllowance,
    transportAllowance,
    otherAllowances,
    description
  } = req.body;

  const grade = await SalaryGrade.findOne({
    _id: req.params.id,
    companyId: req.companyId,
    isActive: true
  });

  if (!grade) {
    return sendError(res, 'Salary grade not found', 404);
  }

  // Validate duplicate name if it's changing
  if (name && name.trim() !== grade.name) {
    const duplicate = await SalaryGrade.findOne({
      companyId: req.companyId,
      name: name.trim(),
      isActive: true
    });
    if (duplicate) {
      return sendError(res, 'A salary grade with this name already exists', 400);
    }
    grade.name = name.trim();
  }

  if (level !== undefined) grade.level = level;
  if (basicSalary !== undefined) grade.basicSalary = basicSalary;
  if (housingAllowance !== undefined) grade.housingAllowance = housingAllowance;
  if (transportAllowance !== undefined) grade.transportAllowance = transportAllowance;
  if (otherAllowances !== undefined) grade.otherAllowances = otherAllowances;
  if (description !== undefined) grade.description = description;

  const updatedGrade = await grade.save();

  return sendSuccess(res, 'Salary grade updated successfully', { grade: updatedGrade });
});

/**
 * Soft deletes a salary grade by setting isActive: false.
 */
exports.deleteGrade = catchAsync(async (req, res) => {
  const grade = await SalaryGrade.findOne({
    _id: req.params.id,
    companyId: req.companyId,
    isActive: true
  });

  if (!grade) {
    return sendError(res, 'Salary grade not found', 404);
  }

  grade.isActive = false;
  await grade.save();

  return sendSuccess(res, 'Salary grade deleted successfully', { gradeId: grade._id });
});
