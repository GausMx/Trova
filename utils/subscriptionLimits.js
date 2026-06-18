const { SUBSCRIPTION_TIERS } = require('../config/constants');

/**
 * Resolves the active employee limit for a company based on its subscription tier and trial status.
 * 
 * @param {Object} company - Company database document
 * @returns {number} Employee limit (Infinity for Enterprise or unlimited)
 */
const getSubscriptionEmployeeLimit = (company) => {
  if (!company) return 20; // Safe fallback

  // Active trial runs on the Growth plan limits (100 employees)
  if (company.subscriptionStatus === 'trial') {
    return 100;
  }

  const tier = company.subscriptionTier;
  
  if (tier === SUBSCRIPTION_TIERS.STARTER) {
    return 20;
  }
  
  if (tier === SUBSCRIPTION_TIERS.GROWTH) {
    return 100;
  }

  if (tier === SUBSCRIPTION_TIERS.ENTERPRISE) {
    return Infinity;
  }

  return 20; // Default fallback for unknown tiers
};

module.exports = {
  getSubscriptionEmployeeLimit
};
