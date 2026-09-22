const { stringify } = require('csv-stringify/sync');
const XLSX = require('xlsx');

/**
 * Compliance Schedule Generator Module for Nigerian Regulatory Portals.
 * Auto-generates TaxPro Max CSV, PenCom Excel, NSITF CSV, and NHF CSV.
 */

/**
 * Generates TaxPro Max / State e-Tax Portal PAYE Schedule in CSV format.
 */
const generateTaxProMaxCsv = (payrollRun) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[payrollRun.month - 1]} ${payrollRun.year}`;

  const headers = [
    'Employee TIN',
    'Staff ID',
    'Employee Name',
    'State of Residence (Tax Authority)',
    'Gross Salary (NGN)',
    'Prorated Gross (NGN)',
    'PAYE Tax Amount (NGN)',
    'Remittance Month'
  ];

  const rows = (payrollRun.employees || []).map((pe) => {
    const emp = pe.employeeId || {};
    return [
      emp.tin || 'N/A',
      pe.staffId || emp.staffId || '',
      pe.name || emp.fullName || '',
      emp.stateOfWork || 'Lagos',
      (pe.grossSalary || 0).toFixed(2),
      (pe.proratedGross || 0).toFixed(2),
      (pe.taxDeduction || 0).toFixed(2),
      periodLabel
    ];
  });

  const csvContent = stringify([headers, ...rows]);
  return {
    filename: `taxpro_max_paye_${payrollRun.month}_${payrollRun.year}.csv`,
    contentType: 'text/csv',
    content: csvContent
  };
};

/**
 * Generates PenCom / PFA Portal Pension Schedule in Excel (XLSX) format.
 */
const generatePenComExcel = (payrollRun, companyName = 'Company') => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[payrollRun.month - 1]} ${payrollRun.year}`;

  const rows = (payrollRun.employees || []).map((pe) => {
    const emp = pe.employeeId || {};
    const empPension = pe.pensionDeduction || 0;
    const emprPension = pe.employerPensionContribution || 0;
    const totalPension = empPension + emprPension;

    return {
      'Staff ID': pe.staffId || emp.staffId || '',
      'Employee Name': pe.name || emp.fullName || '',
      'RSA PIN': emp.pensionPin || 'PEN-PENDING',
      'PFA Name': emp.pfaName || 'Stanbic IBTC Pension Managers',
      'Employee Contribution (8%)': empPension.toFixed(2),
      'Employer Contribution (10%)': emprPension.toFixed(2),
      'Total Contribution (18%)': totalPension.toFixed(2),
      'Period': periodLabel
    };
  });

  const headers = [
    'Staff ID',
    'Employee Name',
    'RSA PIN',
    'PFA Name',
    'Employee Contribution (8%)',
    'Employer Contribution (10%)',
    'Total Contribution (18%)',
    'Period'
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();

  const sheetName = `PenCom Schedule ${payrollRun.month}-${payrollRun.year}`.substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return {
    filename: `pencom_pension_schedule_${payrollRun.month}_${payrollRun.year}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer
  };
};

/**
 * Generates NSITF 1% Employee Compensation Scheme Schedule in CSV format.
 */
const generateNsitfCsv = (payrollRun) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[payrollRun.month - 1]} ${payrollRun.year}`;

  const headers = [
    'Staff ID',
    'Employee Name',
    'Prorated Monthly Gross (NGN)',
    'NSITF Contribution (1%) (NGN)',
    'Period'
  ];

  const rows = (payrollRun.employees || []).map((pe) => {
    const emp = pe.employeeId || {};
    return [
      pe.staffId || emp.staffId || '',
      pe.name || emp.fullName || '',
      (pe.proratedGross || 0).toFixed(2),
      (pe.nsitfContribution || 0).toFixed(2),
      periodLabel
    ];
  });

  const csvContent = stringify([headers, ...rows]);
  return {
    filename: `nsitf_ecs_schedule_${payrollRun.month}_${payrollRun.year}.csv`,
    contentType: 'text/csv',
    content: csvContent
  };
};

/**
 * Generates National Housing Fund (NHF) Schedule in CSV format.
 */
const generateNhfCsv = (payrollRun) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[payrollRun.month - 1]} ${payrollRun.year}`;

  const headers = [
    'Staff ID',
    'Employee Name',
    'Basic Salary (NGN)',
    'NHF Contribution (2.5%) (NGN)',
    'Period'
  ];

  const nhfEmployees = (payrollRun.employees || []).filter((pe) => (pe.nhfDeduction || 0) > 0);

  const rows = nhfEmployees.map((pe) => {
    const emp = pe.employeeId || {};
    return [
      pe.staffId || emp.staffId || '',
      pe.name || emp.fullName || '',
      (pe.basicSalary || 0).toFixed(2),
      (pe.nhfDeduction || 0).toFixed(2),
      periodLabel
    ];
  });

  const csvContent = stringify([headers, ...rows]);
  return {
    filename: `nhf_fmbn_schedule_${payrollRun.month}_${payrollRun.year}.csv`,
    contentType: 'text/csv',
    content: csvContent
  };
};

/**
 * Generates State-Specific PAYE Tax Schedule in CSV format for a specific State IRS (e.g., LIRS, OGIRS, FCT-IRS).
 * Mandatory fields: Employee Full Name, Employee TIN, Gross Pay, Allowable Deductions, Taxable Pay, Monthly PAYE Tax.
 */
const generateStatePayeCsv = (payrollRun, stateName = 'Lagos') => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[payrollRun.month - 1]} ${payrollRun.year}`;
  const targetState = (stateName || 'Lagos').trim();

  const headers = [
    'Staff ID',
    'Employee Full Name',
    'Employee TIN',
    'State of Residence',
    'Gross Pay (NGN)',
    'Allowable Deductions (NGN)',
    'Taxable Pay (NGN)',
    'Monthly PAYE Tax (NGN)',
    'Remittance Period'
  ];

  const filteredEmployees = (payrollRun.employees || []).filter((pe) => {
    const emp = pe.employeeId || {};
    const state = emp.stateOfWork || 'Lagos';
    return state.toLowerCase().trim() === targetState.toLowerCase();
  });

  const rows = filteredEmployees.map((pe) => {
    const emp = pe.employeeId || {};
    const gross = pe.proratedGross || pe.grossSalary || 0;
    const pension = pe.pensionDeduction || 0;
    const nhf = pe.nhfDeduction || 0;
    const nhis = pe.nhisDeduction || 0;
    
    // Monthly rent relief (20% of rent capped at N500k annual = N41,666.67/mo)
    const annualRent = emp.annualRentPaid || 0;
    const monthlyRentRelief = Math.min(annualRent * 0.20, 500000) / 12;
    const monthlyLifeInsurance = (emp.annualLifeInsurance || 0) / 12;
    
    const allowableDeductions = pension + nhf + nhis + monthlyRentRelief + monthlyLifeInsurance;
    const taxablePay = Math.max(0, gross - allowableDeductions);
    const tax = pe.taxDeduction || 0;

    return [
      pe.staffId || emp.staffId || '',
      pe.name || emp.fullName || '',
      emp.tin || 'N/A',
      emp.stateOfWork || targetState,
      gross.toFixed(2),
      allowableDeductions.toFixed(2),
      taxablePay.toFixed(2),
      tax.toFixed(2),
      periodLabel
    ];
  });

  const csvContent = stringify([headers, ...rows]);
  const cleanStateName = targetState.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  return {
    filename: `paye_schedule_${cleanStateName}_${payrollRun.month}_${payrollRun.year}.csv`,
    contentType: 'text/csv',
    content: csvContent,
    stateName: targetState,
    recordCount: filteredEmployees.length
  };
};

module.exports = {
  generateTaxProMaxCsv,
  generateStatePayeCsv,
  generatePenComExcel,
  generateNsitfCsv,
  generateNhfCsv
};
