/**
 * Statutory payroll constants for Nigerian taxation (PITA 2011) and contributions.
 */

module.exports = {
  // PITA 2011 Progressive Tax Bands (Annual)
  TAX_BANDS: [
    { limit: 300000, rate: 0.07 },  // First N300,000
    { limit: 300000, rate: 0.11 },  // Next N300,000
    { limit: 500000, rate: 0.15 },  // Next N500,000
    { limit: 500000, rate: 0.19 },  // Next N500,000
    { limit: 1600000, rate: 0.21 }, // Next N1,600,000
    { limit: Infinity, rate: 0.24 } // Above N3,200,000
  ],

  // Pension Rates (based on Basic + Housing + Transport)
  PENSION: {
    EMPLOYEE_RATE: 0.08, // 8%
    EMPLOYER_RATE: 0.10, // 10%
  },

  // National Housing Fund (NHF) (based on Basic Salary)
  NHF: {
    EMPLOYEE_RATE: 0.025, // 2.5%
  },

  // Consolidated Relief Allowance (CRA)
  CRA: {
    BASE_FLAT: 200000,    // N200,000 flat relief
    PERCENT_OF_GROSS: 0.01, // 1% of gross income
    ADDITIONAL_PERCENT_OF_GROSS: 0.20, // 20% of gross income
  },

  // Minimum Tax Rate (applied if computed tax is less than 1% of gross income)
  MINIMUM_TAX_RATE: 0.01, // 1%

  // Subscription tiers
  SUBSCRIPTION_TIERS: {
    STARTER: 'starter',
    GROWTH: 'growth',
    ENTERPRISE: 'enterprise'
  },

  // Trial length in days
  TRIAL_DAYS: 30,

  // Company status
  COMPANY_STATUS: {
    ACTIVE: 'active',
    SUSPENDED: 'suspended'
  },

  // User roles
  USER_ROLES: {
    OWNER: 'owner',
    ADMIN: 'admin',
    HR: 'hr',
    FINANCE: 'finance'
  },

  // Employee status
  EMPLOYEE_STATUS: {
    ACTIVE: 'active',
    TERMINATED: 'terminated'
  },

  // Payroll run status
  PAYROLL_STATUS: {
    DRAFT: 'draft',
    APPROVED: 'approved',
    PAID: 'paid'
  }
};
