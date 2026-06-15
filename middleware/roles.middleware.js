const Company = require('../models/Company');
const Employee = require('../models/Employee');
const catchAsync = require('../utils/catchAsync');
const { sendError } = require('../utils/responseHandler');
const { COMPANY_STATUS, SUBSCRIPTION_TIERS } = require('../config/constants');

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

/**
 * Middleware to enforce subscription employee limits and trial expiration.
 * Must be mounted after checkCompanyStatus.
 */
const checkSubscriptionLimits = catchAsync(async (req, res, next) => {
  if (!req.company) {
    return sendError(res, 'Company context missing.', 400);
  }

  const company = req.company;

  // 1. Check trial status
  if (company.isTrial) {
    const now = Date.now();
    if (!company.trialEndsAt || now >= new Date(company.trialEndsAt).getTime()) {
      return sendError(
        res,
        'Your 30-day free trial has expired. Please upgrade your subscription on the billing page to continue running payroll.',
        403
      );
    }
    // Active trial: Growth features with no employee limits
    return next();
  }

  // 2. Check active employee limits on paid tiers
  const activeEmployeeCount = await Employee.countDocuments({
    companyId: company._id,
    status: 'active'
  });

  if (company.subscriptionTier === SUBSCRIPTION_TIERS.STARTER) {
    if (activeEmployeeCount > 20) {
      return sendError(
        res,
        `Your active employee count (${activeEmployeeCount}) exceeds the 20-employee limit of the Starter tier. Please upgrade your subscription on the billing page.`,
        403
      );
    }
  } else if (company.subscriptionTier === SUBSCRIPTION_TIERS.GROWTH) {
    if (activeEmployeeCount > 100) {
      return sendError(
        res,
        `Your active employee count (${activeEmployeeCount}) exceeds the 100-employee limit of the Growth tier. Please upgrade your subscription on the billing page.`,
        403
      );
    }
  }

  next();
});

module.exports = {
  restrictTo,
  checkCompanyStatus,
  checkSubscriptionLimits
};
