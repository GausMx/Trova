const { TAX_BANDS, PENSION, NHF, CRA, MINIMUM_TAX_RATE } = require('../config/constants');

/**
 * Helper to round values to 2 decimal places to prevent floating-point issues.
 * @param {number} num 
 * @returns {number}
 */
const round = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates monthly payroll deductions and net salary based on PITA 2011 regulations.
 * 
 * @param {Object} employee - Employee salary details
 * @param {number} employee.basicSalary - Monthly basic salary (NGN)
 * @param {number} employee.housingAllowance - Monthly housing allowance (NGN)
 * @param {number} employee.transportAllowance - Monthly transport allowance (NGN)
 * @param {number} employee.otherAllowances - Monthly other allowances (NGN)
 * 
 * @returns {Object} Calculated payroll breakdown
 */
const calculateMonthlyPayroll = (employee, attendance = null) => {
  const {
    basicSalary = 0,
    housingAllowance = 0,
    transportAllowance = 0,
    otherAllowances = 0
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
      annualCra: 0,
      annualTaxableIncome: 0,
      annualTax: 0,
      monthlyTax: 0,
      monthlyNet: 0,
      workingDays,
      daysAbsent,
      halfDays,
      daysWorked,
      proratedGross: 0
    };
  }

  // 2. Calculate Pension (8% of Basic + Housing + Transport)
  const monthlyPensionBase = basic + housing + transport;
  const monthlyPension = monthlyPensionBase * PENSION.EMPLOYEE_RATE;
  const annualPension = monthlyPension * 12;

  // 3. Calculate NHF (2.5% of Basic)
  const monthlyNhf = basic * NHF.EMPLOYEE_RATE;
  const annualNhf = monthlyNhf * 12;

  // 4. Calculate Consolidated Relief Allowance (CRA)
  // Formula: Higher of N200,000 or 1% of Gross, plus 20% of Gross
  const flatCRA = Math.max(CRA.BASE_FLAT, annualGross * CRA.PERCENT_OF_GROSS);
  const additionalCRA = annualGross * CRA.ADDITIONAL_PERCENT_OF_GROSS;
  const annualCra = flatCRA + additionalCRA;

  // 5. Calculate Taxable Income (Chargeable Income)
  // Taxable Income = Annual Gross - (Pension + NHF + CRA)
  const annualTaxableIncome = Math.max(0, annualGross - (annualPension + annualNhf + annualCra));

  // 6. Calculate Progressive Tax (PAYE) based on Bands
  let annualTax = 0;
  let remainingTaxable = annualTaxableIncome;

  for (const band of TAX_BANDS) {
    if (remainingTaxable <= 0) break;
    const taxableInThisBand = Math.min(remainingTaxable, band.limit);
    annualTax += taxableInThisBand * band.rate;
    remainingTaxable -= taxableInThisBand;
  }

  // 7. Apply Minimum Tax Check
  // If computed tax is less than 1% of gross income, minimum tax applies
  const minimumTax = annualGross * MINIMUM_TAX_RATE;
  if (annualTax < minimumTax) {
    annualTax = minimumTax;
  }

  // 8. Convert to Monthly values
  const monthlyTax = annualTax / 12;
  const monthlyNet = monthlyGross - (monthlyPension + monthlyNhf + monthlyTax);

  // Return rounded calculations
  return {
    monthlyGross: round(monthlyGross),
    annualGross: round(annualGross),
    monthlyPension: round(monthlyPension),
    annualPension: round(annualPension),
    monthlyNhf: round(monthlyNhf),
    annualNhf: round(annualNhf),
    annualCra: round(annualCra),
    annualTaxableIncome: round(annualTaxableIncome),
    annualTax: round(annualTax),
    monthlyTax: round(monthlyTax),
    monthlyNet: round(monthlyNet),
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
