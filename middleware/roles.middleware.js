const Company = require('../models/Company');
const Employee = require('../models/Employee');
const catchAsync = require('../utils/catchAsync');
const { sendError } = require('../utils/responseHandler');
const { COMPANY_STATUS, SUBSCRIPTION_TIERS } = require('../config/constants');
const { getSubscriptionEmployeeLimit } = require('../utils/subscriptionLimits');

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
  }

  // 2. Check active employee limits on paid tiers
  const activeEmployeeCount = await Employee.countDocuments({
    companyId: company._id,
    status: 'active'
  });

  const limit = getSubscriptionEmployeeLimit(company);

  if (activeEmployeeCount > limit) {
    const tierName = company.subscriptionStatus === 'trial' ? 'trial' : `${company.subscriptionTier} plan`;
    return res.status(403).json({
      success: false,
      message: `Your active employee count (${activeEmployeeCount}) exceeds the ${tierName} limit of ${limit} employees. Upgrade your plan to process payroll.`,
      currentCount: activeEmployeeCount,
      limit,
      upgradeUrl: '/billing'
    });
  }

  next();
});

const TIER_FEATURES = {
  starter: [
    'employee_management',
    'basic_payroll',
    'pdf_payslips',
    'email_support'
  ],
  growth: [
    'employee_management',
    'basic_payroll',
    'salary_grades',
    'attendance_proration',
    'pdf_payslips',
    'compliance_calendar',
    'bulk_payment_file',
    'email_support',
    'priority_support'
  ],
  enterprise: [
    'employee_management',
    'basic_payroll',
    'salary_grades',
    'attendance_proration',
    'pdf_payslips',
    'compliance_calendar',
    'ai_copilot',
    'bulk_payment_file',
    'custom_paye_config',
    'unlimited_employees',
    'email_support',
    'priority_support',
    'phone_support',
    'sla_guarantee'
  ]
};

const getRequiredTier = (feature) => {
  const tiers = ['starter', 'growth', 'enterprise'];
  for (const tier of tiers) {
    if (TIER_FEATURES[tier].includes(feature)) {
      return tier;
    }
  }
  return 'enterprise';
};

const checkFeatureAccess = (feature) => {
  return catchAsync(async (req, res, next) => {
    let company = req.company;
    if (!company && req.companyId) {
      company = await Company.findById(req.companyId);
      req.company = company;
    }

    if (!company) {
      return sendError(res, 'Company context missing.', 400);
    }

    let effectiveTier = company.subscriptionTier || 'starter';
    if (company.subscriptionStatus === 'trial') {
      effectiveTier = 'growth';
    }

    const features = TIER_FEATURES[effectiveTier] || [];
    if (!features.includes(feature)) {
      const requiredTier = getRequiredTier(feature);
      return res.status(403).json({
        success: false,
        message: 'This feature requires a higher plan.',
        requiredTier,
        currentTier: company.subscriptionTier,
        upgradeUrl: '/billing'
      });
    }

    next();
  });
};

const checkSubscriptionActive = catchAsync(async (req, res, next) => {
  if (!req.company) {
    return sendError(res, 'Company context missing.', 400);
  }

  const company = req.company;

  const isTrialActive = company.subscriptionStatus === 'trial' && company.trialEndsAt && Date.now() < new Date(company.trialEndsAt).getTime();
  const isPaidActive = company.subscriptionStatus === 'active';

  if (!isTrialActive && !isPaidActive) {
    return res.status(403).json({
      success: false,
      message: 'Trial has ended and subscription is required.',
      code: 'SUBSCRIPTION_REQUIRED',
      upgradeUrl: '/billing'
    });
  }

  next();
});

module.exports = {
  restrictTo,
  checkCompanyStatus,
  checkSubscriptionLimits,
  checkFeatureAccess,
  checkSubscriptionActive
};
