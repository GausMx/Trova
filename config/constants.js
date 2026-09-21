/**
 * Statutory payroll constants for Nigerian taxation (PITA 2011) and contributions.
 */

module.exports = {
  // 2026 Progressive Tax Bands (Annual)
  TAX_BANDS: [
    { limit: 800000, rate: 0.00 },   // First N800,000
    { limit: 2200000, rate: 0.15 },  // Next N2,200,000
    { limit: 9000000, rate: 0.18 },  // Next N9,000,000
    { limit: 13000000, rate: 0.21 }, // Next N13,000,000
    { limit: 25000000, rate: 0.23 }, // Next N25,000,000
    { limit: Infinity, rate: 0.25 }  // Above N50,000,000
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
  },

  // Nigerian bank codes
  BANK_CODES: {
    'GTBank': '058',
    'Access Bank': '044',
    'Zenith Bank': '057',
    'First Bank': '011',
    'UBA': '033',
    'Fidelity Bank': '070',
    'Sterling Bank': '232',
    'Stanbic IBTC': '221',
    'Union Bank': '032',
    'Polaris Bank': '076',
    'Wema Bank': '035',
    'FCMB': '214',
    'Keystone Bank': '082',
    'Ecobank': '050',
    'Heritage Bank': '030',
    'Kuda Bank': '090267',
    'Opay': '100004',
    'Moniepoint': '090405',
    'PalmPay': '100033'
  },

  // 36 States + FCT for multi-state PAYE SIRS routing
  NIGERIAN_STATES: [
    { code: 'Abia', name: 'Abia (ABIRS)' },
    { code: 'Adamawa', name: 'Adamawa (ADIRS)' },
    { code: 'Akwa Ibom', name: 'Akwa Ibom (AKIRS)' },
    { code: 'Anambra', name: 'Anambra (AIRS)' },
    { code: 'Bauchi', name: 'Bauchi (BASIRS)' },
    { code: 'Bayelsa', name: 'Bayelsa (BYIRS)' },
    { code: 'Benue', name: 'Benue (BIRS)' },
    { code: 'Borno', name: 'Borno (BOIRS)' },
    { code: 'Cross River', name: 'Cross River (CRIRS)' },
    { code: 'Delta', name: 'Delta (DBIR)' },
    { code: 'Ebonyi', name: 'Ebonyi (EBSIRS)' },
    { code: 'Edo', name: 'Edo (EIRS)' },
    { code: 'Ekiti', name: 'Ekiti (EKIRS)' },
    { code: 'Enugu', name: 'Enugu (ESIRS)' },
    { code: 'FCT', name: 'Abuja (FCT-IRS)' },
    { code: 'Gombe', name: 'Gombe (GROIRS)' },
    { code: 'Imo', name: 'Imo (IIRS)' },
    { code: 'Jigawa', name: 'Jigawa (JIRS)' },
    { code: 'Kaduna', name: 'Kaduna (KADIRS)' },
    { code: 'Kano', name: 'Kano (KIRS)' },
    { code: 'Katsina', name: 'Katsina (KATIRS)' },
    { code: 'Kebbi', name: 'Kebbi (KBIRS)' },
    { code: 'Kogi', name: 'Kogi (KGIRS)' },
    { code: 'Kwara', name: 'Kwara (KWIRS)' },
    { code: 'Lagos', name: 'Lagos (LIRS)' },
    { code: 'Nasarawa', name: 'Nasarawa (NSBIR)' },
    { code: 'Niger', name: 'Niger (NGSIRS)' },
    { code: 'Ogun', name: 'Ogun (OGIRS)' },
    { code: 'Ondo', name: 'Ondo (ODIRS)' },
    { code: 'Osun', name: 'Osun (OSIRS)' },
    { code: 'Oyo', name: 'Oyo (OYIRS)' },
    { code: 'Plateau', name: 'Plateau (PSIRS)' },
    { code: 'Rivers', name: 'Rivers (RIRS)' },
    { code: 'Sokoto', name: 'Sokoto (SOIRS)' },
    { code: 'Taraba', name: 'Taraba (TIRS)' },
    { code: 'Yobe', name: 'Yobe (YIRS)' },
    { code: 'Zamfara', name: 'Zamfara (ZIRS)' }
  ]
};
