/**
 * Remita Multi-Agency Biller Registry & Routing Engine for Trova.
 * Provides metadata for State IRS PAYE routing across all 36 states + FCT,
 * Pension Fund Administrators (PFAs) to Pension Fund Custodians (PFCs),
 * and statutory federal bodies (NSITF, NHF, NHIA, ITF).
 */

// State Internal Revenue Service (IRS) Remita Biller Registry (36 States + FCT)
const STATE_IRS_BILLERS = {
  'Abia': { billerId: '100001001', name: 'Abia State Internal Revenue Service (ABIRS)' },
  'Adamawa': { billerId: '100001002', name: 'Adamawa State Board of Internal Revenue' },
  'Akwa Ibom': { billerId: '100001003', name: 'Akwa Ibom State Internal Revenue Service (AKIRS)' },
  'Anambra': { billerId: '100001004', name: 'Anambra State Internal Revenue Service (AIRS)' },
  'Bauchi': { billerId: '100001005', name: 'Bauchi State Board of Internal Revenue' },
  'Bayelsa': { billerId: '100001006', name: 'Bayelsa State Board of Internal Revenue (BYIRS)' },
  'Benue': { billerId: '100001007', name: 'Benue State Internal Revenue Service (BIRS)' },
  'Borno': { billerId: '100001008', name: 'Borno State Board of Internal Revenue' },
  'Cross River': { billerId: '100001009', name: 'Cross River State Internal Revenue Service (CRIRS)' },
  'Delta': { billerId: '100001010', name: 'Delta State Board of Internal Revenue (DBIR)' },
  'Ebonyi': { billerId: '100001011', name: 'Ebonyi State Internal Revenue Service (EBSIRS)' },
  'Edo': { billerId: '100001012', name: 'Edo State Internal Revenue Service (EIRS)' },
  'Ekiti': { billerId: '100001013', name: 'Ekiti State Internal Revenue Service (EKIRS)' },
  'Enugu': { billerId: '100001014', name: 'Enugu State Internal Revenue Service (ESIRS)' },
  'FCT': { billerId: '100001000', name: 'FCT Internal Revenue Service (FCT-IRS)' },
  'Federal Capital Territory': { billerId: '100001000', name: 'FCT Internal Revenue Service (FCT-IRS)' },
  'Abuja': { billerId: '100001000', name: 'FCT Internal Revenue Service (FCT-IRS)' },
  'Gombe': { billerId: '100001015', name: 'Gombe State Internal Revenue Service (GROIRS)' },
  'Imo': { billerId: '100001016', name: 'Imo State Internal Revenue Service (IIRS)' },
  'Jigawa': { billerId: '100001017', name: 'Jigawa State Board of Internal Revenue' },
  'Kaduna': { billerId: '100001018', name: 'Kaduna State Internal Revenue Service (KADIRS)' },
  'Kano': { billerId: '100001019', name: 'Kano State Internal Revenue Service (KIRS)' },
  'Katsina': { billerId: '100001020', name: 'Katsina State Board of Internal Revenue' },
  'Kebbi': { billerId: '100001021', name: 'Kebbi State Board of Internal Revenue' },
  'Kogi': { billerId: '100001022', name: 'Kogi State Internal Revenue Service (KGIRS)' },
  'Kwara': { billerId: '100001023', name: 'Kwara State Internal Revenue Service (KWIRS)' },
  'Lagos': { billerId: '100001024', name: 'Lagos State Internal Revenue Service (LIRS)' },
  'Nasarawa': { billerId: '100001025', name: 'Nasarawa State Board of Internal Revenue (NSBIR)' },
  'Niger': { billerId: '100001026', name: 'Niger State Board of Internal Revenue (NGSIRS)' },
  'Ogun': { billerId: '100001027', name: 'Ogun State Internal Revenue Service (OGIRS)' },
  'Ondo': { billerId: '100001028', name: 'Ondo State Internal Revenue Service (ODIRS)' },
  'Osun': { billerId: '100001029', name: 'Osun State Internal Revenue Service (IRS)' },
  'Oyo': { billerId: '100001030', name: 'Oyo State Board of Internal Revenue (OYIRS)' },
  'Plateau': { billerId: '100001031', name: 'Plateau State Internal Revenue Service (PSIRS)' },
  'Rivers': { billerId: '100001032', name: 'Rivers State Board of Internal Revenue (RIRS)' },
  'Sokoto': { billerId: '100001033', name: 'Sokoto State Board of Internal Revenue' },
  'Taraba': { billerId: '100001034', name: 'Taraba State Board of Internal Revenue' },
  'Yobe': { billerId: '100001035', name: 'Yobe State Board of Internal Revenue' },
  'Zamfara': { billerId: '100001036', name: 'Zamfara State Board of Internal Revenue' }
};

// Pension Fund Administrators (PFAs) mapped to Pension Fund Custodians (PFCs) & PenCom PFA Codes
const PFA_REGISTRY = {
  'Stanbic IBTC Pension Managers': {
    pfaCode: '021',
    billerId: 'PFA-001',
    pfcName: 'First Pension Custodian Nigeria Limited',
    pfcAccount: '2001122334',
    pfcBankCode: '011'
  },
  'Leadway Pensure PFA': {
    pfaCode: '001',
    billerId: 'PFA-002',
    pfcName: 'Zenith Pensions Custodian Limited',
    pfcAccount: '1012233445',
    pfcBankCode: '057'
  },
  'ARM Pension Managers': {
    pfaCode: '003',
    billerId: 'PFA-003',
    pfcName: 'UBA Pension Custodian Limited',
    pfcAccount: '3003344556',
    pfcBankCode: '033'
  },
  'Premium Pension Limited': {
    pfaCode: '004',
    billerId: 'PFA-004',
    pfcName: 'First Pension Custodian Nigeria Limited',
    pfcAccount: '2004455667',
    pfcBankCode: '011'
  },
  'FCMB Pensions Limited': {
    pfaCode: '005',
    billerId: 'PFA-005',
    pfcName: 'Zenith Pensions Custodian Limited',
    pfcAccount: '1015566778',
    pfcBankCode: '057'
  },
  'Trustfund Pensions Limited': {
    pfaCode: '006',
    billerId: 'PFA-006',
    pfcName: 'UBA Pension Custodian Limited',
    pfcAccount: '3006677889',
    pfcBankCode: '033'
  },
  'Access Pensions': {
    pfaCode: '007',
    billerId: 'PFA-007',
    pfcName: 'First Pension Custodian Nigeria Limited',
    pfcAccount: '2007788990',
    pfcBankCode: '011'
  },
  'Tangerine APT Pensions': {
    pfaCode: '008',
    billerId: 'PFA-008',
    pfcName: 'Zenith Pensions Custodian Limited',
    pfcAccount: '1018899001',
    pfcBankCode: '057'
  },
  'NLPC PFA Limited': {
    pfaCode: '009',
    billerId: 'PFA-009',
    pfcName: 'UBA Pension Custodian Limited',
    pfcAccount: '3009900112',
    pfcBankCode: '033'
  },
  'Veritas Glanvills Pensions': {
    pfaCode: '010',
    billerId: 'PFA-010',
    pfcName: 'First Pension Custodian Nigeria Limited',
    pfcAccount: '2001112233',
    pfcBankCode: '011'
  }
};

// Federal Statutory Bodies
const STATUTORY_AGENCIES = {
  NSITF: {
    billerId: 'FED-NSITF-01',
    name: 'Nigeria Social Insurance Trust Fund (NSITF)',
    remittanceType: 'NSITF'
  },
  NHF: {
    billerId: 'FED-FMBN-02',
    name: 'Federal Mortgage Bank of Nigeria (NHF)',
    remittanceType: 'NHF'
  },
  NHIS: {
    billerId: 'FED-NHIA-03',
    name: 'National Health Insurance Authority (NHIA)',
    remittanceType: 'NHIS'
  },
  ITF: {
    billerId: 'FED-ITF-04',
    name: 'Industrial Training Fund (ITF)',
    remittanceType: 'ITF'
  }
};

/**
 * Returns the State IRS Biller ID and details for a given state name.
 * Defaults to Lagos State IRS if not found.
 */
const getStateBillerId = (stateName) => {
  if (!stateName) return STATE_IRS_BILLERS['Lagos'];
  const formatted = stateName.trim();
  const stateObj = STATE_IRS_BILLERS[formatted];
  if (stateObj) return stateObj;

  // Case-insensitive fallback check
  const entry = Object.entries(STATE_IRS_BILLERS).find(
    ([k]) => k.toLowerCase() === formatted.toLowerCase()
  );
  return entry ? entry[1] : STATE_IRS_BILLERS['Lagos'];
};

/**
 * Returns PFA custodian details for a given PFA name.
 * Defaults to Stanbic IBTC Pension Managers if not found.
 */
const getPfaCustodianDetails = (pfaName) => {
  if (!pfaName) return PFA_REGISTRY['Stanbic IBTC Pension Managers'];
  const formatted = pfaName.trim();
  if (PFA_REGISTRY[formatted]) return PFA_REGISTRY[formatted];

  const entry = Object.entries(PFA_REGISTRY).find(
    ([k]) => k.toLowerCase() === formatted.toLowerCase()
  );
  return entry ? entry[1] : PFA_REGISTRY['Stanbic IBTC Pension Managers'];
};

/**
 * Aggregates a payroll run's employee roster into routing line items for statutory remittances & net salaries.
 * Groups PAYE tax by State IRS, Pension by PFA/PFC, and aggregates NSITF, NHF, NHIS.
 */
const aggregatePayrollRouting = (payrollRunEmployees = []) => {
  const round = (val) => Math.round((val + Number.EPSILON) * 100) / 100;

  // 1. Group PAYE Tax by Employee State of Work
  const payeByState = {};
  // 2. Group Pension by PFA
  const pensionByPfa = {};

  let totalNetSalaries = 0;
  let totalTax = 0;
  let totalEmployeePension = 0;
  let totalEmployerPension = 0;
  let totalNhf = 0;
  let totalNhis = 0;
  let totalNsitf = 0;
  let totalItf = 0;

  for (const item of payrollRunEmployees) {
    const emp = item.employeeId || {};
    const state = emp.stateOfWork || 'Lagos';
    const pfaName = emp.pfaName || 'Stanbic IBTC Pension Managers';

    // Tax aggregation
    const taxAmt = item.taxDeduction || 0;
    if (taxAmt > 0) {
      if (!payeByState[state]) {
        payeByState[state] = {
          state,
          biller: getStateBillerId(state),
          employeeCount: 0,
          totalTax: 0
        };
      }
      payeByState[state].employeeCount += 1;
      payeByState[state].totalTax += taxAmt;
    }

    // Pension aggregation (8% employee + 10% employer)
    const empPension = item.pensionDeduction || 0;
    const emprPension = item.employerPensionContribution || 0;
    const pensionTotal = empPension + emprPension;

    if (pensionTotal > 0) {
      if (!pensionByPfa[pfaName]) {
        const details = getPfaCustodianDetails(pfaName);
        pensionByPfa[pfaName] = {
          pfaName,
          pfcName: details.pfcName,
          pfcAccount: details.pfcAccount,
          billerId: details.billerId,
          employeeCount: 0,
          employeeContribution: 0,
          employerContribution: 0,
          totalPension: 0
        };
      }
      pensionByPfa[pfaName].employeeCount += 1;
      pensionByPfa[pfaName].employeeContribution += empPension;
      pensionByPfa[pfaName].employerContribution += emprPension;
      pensionByPfa[pfaName].totalPension += pensionTotal;
    }

    totalNetSalaries += item.netSalary || 0;
    totalTax += taxAmt;
    totalEmployeePension += empPension;
    totalEmployerPension += emprPension;
    totalNhf += item.nhfDeduction || 0;
    totalNhis += (item.nhisDeduction || 0) + (item.employerNhisContribution || 0);
    totalNsitf += item.nsitfContribution || 0;
    totalItf += item.itfContribution || 0;
  }

  // Format grouped PAYE
  const payeLineItems = Object.values(payeByState).map((p) => ({
    ...p,
    totalTax: round(p.totalTax)
  }));

  // Format grouped Pension
  const pensionLineItems = Object.values(pensionByPfa).map((p) => ({
    ...p,
    employeeContribution: round(p.employeeContribution),
    employerContribution: round(p.employerContribution),
    totalPension: round(p.totalPension)
  }));

  const totalPensionCombined = round(totalEmployeePension + totalEmployerPension);
  const totalStatutory = round(
    totalTax + totalPensionCombined + totalNhf + totalNhis + totalNsitf + totalItf
  );
  const totalOutflow = round(totalNetSalaries + totalStatutory);

  return {
    summary: {
      netSalaries: round(totalNetSalaries),
      payeTax: round(totalTax),
      pension: totalPensionCombined,
      pensionBreakdown: {
        employeeShare: round(totalEmployeePension),
        employerShare: round(totalEmployerPension)
      },
      nsitf: round(totalNsitf),
      nhf: round(totalNhf),
      nhis: round(totalNhis),
      itf: round(totalItf),
      totalStatutory,
      totalOutflow
    },
    routing: {
      payeByState: payeLineItems,
      pensionByPfa: pensionLineItems,
      nsitf: {
        agency: STATUTORY_AGENCIES.NSITF,
        amount: round(totalNsitf)
      },
      nhf: {
        agency: STATUTORY_AGENCIES.NHF,
        amount: round(totalNhf)
      },
      nhis: {
        agency: STATUTORY_AGENCIES.NHIS,
        amount: round(totalNhis)
      }
    }
  };
};

const getPfaCode = (pfaName, pfaCode) => {
  if (pfaCode && pfaCode.trim()) return pfaCode.trim();
  if (!pfaName) return '021';
  const details = getPfaCustodianDetails(pfaName);
  return details ? details.pfaCode || '021' : '021';
};

module.exports = {
  STATE_IRS_BILLERS,
  PFA_REGISTRY,
  STATUTORY_AGENCIES,
  getStateBillerId,
  getPfaCustodianDetails,
  getPfaCode,
  aggregatePayrollRouting
};
