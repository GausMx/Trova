const Company = require('../models/Company');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Retrieves the profile of the current authenticated user's company.
 * Uses req.company populated by checkCompanyStatus middleware.
 */
exports.getCompanyProfile = catchAsync(async (req, res) => {
  return sendSuccess(res, 'Company profile retrieved successfully', {
    company: req.company
  });
});

/**
 * Updates the details of the authenticated user's company.
 */
exports.updateCompanyProfile = catchAsync(async (req, res) => {
  const { name, industry, address } = req.body;

  // 1. If name is being changed, verify it is not already taken by another tenant
  if (name && name !== req.company.name) {
    const duplicate = await Company.findOne({ name });
    if (duplicate) {
      return sendError(res, 'Company name is already registered by another user', 400);
    }
    req.company.name = name;
  }

  // 2. Update allowed fields
  if (industry !== undefined) req.company.industry = industry;
  if (address !== undefined) req.company.address = address;

  const updatedCompany = await req.company.save();

  return sendSuccess(res, 'Company profile updated successfully', {
    company: updatedCompany
  });
});
