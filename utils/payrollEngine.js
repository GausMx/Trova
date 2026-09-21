const { TAX_BANDS, PENSION, NHF } = require('../config/constants');

/**
 * Helper to round values to 2 decimal places to prevent floating-point issues.
 * @param {number} num 
 * @returns {number}
 */
const round = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates monthly payroll deductions and net salary based on 2026 progressive regulations.
 * 
 * @param {Object} employee - Employee salary and compliance preferences
 * @param {number} employee.basicSalary - Monthly basic salary (NGN)
 * @param {number} employee.housingAllowance - Monthly housing allowance (NGN)
 * @param {number} employee.transportAllowance - Monthly transport allowance (NGN)
 * @param {number} employee.otherAllowances - Monthly other allowances (NGN)
 * @param {boolean} employee.nhfOptIn - Whether opted into voluntary NHF
 * @param {boolean} employee.nhisOptIn - Whether opted into voluntary NHIS
 * @param {number} employee.annualRentPaid - Annual rent paid for Rent Relief
 * @param {number} employee.annualLifeInsurance - Annual Life Insurance premium paid
 * @param {number} employee.companyEmployeeCount - Total active employee count for the company
 * 
 * @returns {Object} Calculated payroll breakdown
 */
const calculateMonthlyPayroll = (employee, attendance = null) => {
  const {
    basicSalary = 0,
    housingAllowance = 0,
    transportAllowance = 0,
    otherAllowances = 0,
    nhfOptIn = employee.nhfOptIn !== undefined ? employee.nhfOptIn : true,
    nhisOptIn = false,
    annualRentPaid = 0,
    annualLifeInsurance = 0,
    companyEmployeeCount = 0
  } = employee;

  const standardGross = basicSalary + housingAllowance + transportAllowance + otherAllowances;

  let basic = basicSalary;
  let housing = housingAllowance;
  let transport = transportAllowance;
  let other = otherAllowances;
  let gross = standardGross;

  let workingDays = 0;
  let daysAbsent = 0;
  let halfDays = 0;
  let daysWorked = 0;

  if (attendance) {
    workingDays = attendance.workingDaysInMonth || 0;
    daysAbsent = attendance.daysAbsent || 0;
    halfDays = attendance.halfDays || 0;
    
    if (workingDays > 0 && (daysAbsent > 0 || halfDays > 0)) {
      daysWorked = Math.max(0, workingDays - daysAbsent - (halfDays * 0.5));
      const factor = daysWorked / workingDays;
      basic = basicSalary * factor;
      housing = housingAllowance * factor;
      transport = transportAllowance * factor;
      other = otherAllowances * factor;
      gross = standardGross * factor;
    } else {
      daysWorked = workingDays;
    }
  }

  // 1. Calculate Monthly & Annual Gross Income
  const monthlyGross = gross;
  const annualGross = monthlyGross * 12;

  // If Gross Income is 0, return zeroed deductions
  if (annualGross <= 0) {
    return {
      monthlyGross: 0,
      annualGross: 0,
      monthlyPension: 0,
      annualPension: 0,
      monthlyNhf: 0,
      annualNhf: 0,
      monthlyNhis: 0,
      annualNhis: 0,
      annualTaxableIncome: 0,
      annualTax: 0,
      monthlyTax: 0,
      monthlyNet: 0,
      employerPensionContribution: 0,
      employerNhisContribution: 0,
      nsitfContribution: 0,
      itfContribution: 0,
      workingDays,
      daysAbsent,
      halfDays,
      daysWorked,
      proratedGross: 0
    };
  }

  // 2. Calculate Pension (8% of Emoluments: Basic + Housing + Transport per PRA 2014)
  // Strictly excludes non-pensionable allowances (otherAllowances)
  const monthlyPensionBase = basic + housing + transport;
  const monthlyPension = monthlyPensionBase * PENSION.EMPLOYEE_RATE;
  const annualPension = monthlyPension * 12;

  // 3. Calculate NHF (2.5% of Basic) - 2026: voluntary for private-sector, defaults to true if omitted
  const monthlyNhf = nhfOptIn ? (basic * NHF.EMPLOYEE_RATE) : 0;
  const annualNhf = monthlyNhf * 12;

  // 4. Calculate NHIS (5% of Basic) - 2026: 5+ employees
  const nhisApplies = (companyEmployeeCount >= 5) || nhisOptIn;
  const monthlyNhis = nhisApplies ? (basic * 0.05) : 0;
  const annualNhis = monthlyNhis * 12;

  // 5. Calculate Rent Relief (20% of annual rent paid, strictly capped at a maximum of N500,000)
  const annualRentRelief = Math.min(annualRentPaid * 0.20, 500000);

  // 6. Life Insurance pre-tax deduction
  const annualLifeInsuranceDeduction = annualLifeInsurance;

  // 7. Calculate Taxable Income (Chargeable Income)
  // Taxable Income = Annual Gross - (Pension + NHF + NHIS + Rent Relief + Life Insurance)
  const totalAllowableDeductions = annualPension + annualNhf + annualNhis + annualRentRelief + annualLifeInsuranceDeduction;
  const annualTaxableIncome = Math.max(0, annualGross - totalAllowableDeductions);

  // 8. Calculate Progressive Tax (PAYE) based on 2026 Bands
  let annualTax = 0;
  let remainingTaxable = annualTaxableIncome;

  for (const band of TAX_BANDS) {
    if (remainingTaxable <= 0) break;
    const taxableInThisBand = Math.min(remainingTaxable, band.limit);
    annualTax += taxableInThisBand * band.rate;
    remainingTaxable -= taxableInThisBand;
  }

  // 9. Enforce Minimum Tax Check (1% of annual gross income)
  const minimumTax = annualGross * 0.01;
  if (annualTax < minimumTax) {
    annualTax = minimumTax;
  }

  // 9. Convert to Monthly values
  const monthlyTax = annualTax / 12;
  const monthlyNet = monthlyGross - (monthlyPension + monthlyNhf + monthlyNhis + monthlyTax);

  // 10. Calculate Employer Overhead Levies
  const employerPensionContribution = monthlyPensionBase * PENSION.EMPLOYER_RATE;
  const employerNhisContribution = nhisApplies ? (basic * 0.10) : 0;
  const nsitfContribution = monthlyGross * 0.01;
  const itfContribution = (companyEmployeeCount >= 5 || annualGross >= 50000000) ? (monthlyGross * 0.01) : 0;

  // Return rounded calculations
  return {
    monthlyGross: round(monthlyGross),
    annualGross: round(annualGross),
    monthlyPension: round(monthlyPension),
    annualPension: round(annualPension),
    monthlyNhf: round(monthlyNhf),
    annualNhf: round(annualNhf),
    monthlyNhis: round(monthlyNhis),
    annualNhis: round(annualNhis),
    annualTaxableIncome: round(annualTaxableIncome),
    annualTax: round(annualTax),
    monthlyTax: round(monthlyTax),
    monthlyNet: round(monthlyNet),
    employerPensionContribution: round(employerPensionContribution),
    employerNhisContribution: round(employerNhisContribution),
    nsitfContribution: round(nsitfContribution),
    itfContribution: round(itfContribution),
    workingDays,
    daysAbsent,
    halfDays,
    daysWorked: round(daysWorked),
    proratedGross: round(monthlyGross)
  };
};

/**
 * Calculates total working days in a given month/year, excluding Saturdays and Sundays.
 * Month is 1-indexed (1 = Jan, 12 = Dec).
 */
const getWorkingDays = (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  const numDays = endDate.getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= numDays; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return workingDays;
};

module.exports = {
  calculateMonthlyPayroll,
  getWorkingDays
};
