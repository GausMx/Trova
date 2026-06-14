const Company = require('../models/Company');
const catchAsync = require('../utils/catchAsync');
const { sendError } = require('../utils/responseHandler');
const { COMPANY_STATUS } = require('../config/constants');

/**
 * Middleware to restrict route access to specific user roles.
 * Must be mounted after the protect authentication middleware.
 * 
 * @param {...string} roles - Permitted user roles
 * @returns {Function} Express middleware
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(
        res,
        'You do not have permission to perform this action',
        403
      );
    }
    next();
  };
};

/**
 * Middleware to check the company's status.
 * Ensures the tenant company exists and is active before allowing request processing.
 */
const checkCompanyStatus = catchAsync(async (req, res, next) => {
  if (!req.companyId) {
    return sendError(res, 'Tenant context missing. Authentication required.', 401);
  }

  const company = await Company.findById(req.companyId);
  if (!company) {
    return sendError(res, 'Associated company not found.', 404);
  }

  if (company.status === COMPANY_STATUS.SUSPENDED) {
    return sendError(
      res,
      'Your company account has been suspended. Please contact customer support.',
      403
    );
  }

  // Attach company to request context
  req.company = company;
  next();
});

module.exports = {
  restrictTo,
  checkCompanyStatus
};
