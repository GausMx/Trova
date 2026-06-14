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
const calculateMonthlyPayroll = (employee) => {
  const {
    basicSalary = 0,
    housingAllowance = 0,
    transportAllowance = 0,
    otherAllowances = 0
  } = employee;

  // 1. Calculate Monthly & Annual Gross Income
  const monthlyGross = basicSalary + housingAllowance + transportAllowance + otherAllowances;
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
      monthlyNet: 0
    };
  }

  // 2. Calculate Pension (8% of Basic + Housing + Transport)
  const monthlyPensionBase = basicSalary + housingAllowance + transportAllowance;
  const monthlyPension = monthlyPensionBase * PENSION.EMPLOYEE_RATE;
  const annualPension = monthlyPension * 12;

  // 3. Calculate NHF (2.5% of Basic)
  const monthlyNhf = basicSalary * NHF.EMPLOYEE_RATE;
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
    monthlyNet: round(monthlyNet)
  };
};

module.exports = {
  calculateMonthlyPayroll
};
