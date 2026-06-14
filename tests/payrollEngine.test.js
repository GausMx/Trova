const { calculateMonthlyPayroll } = require('../utils/payrollEngine');

describe('Nigerian Payroll Engine (PITA 2011 Compliance)', () => {
  test('should return zeroed values for zero input', () => {
    const result = calculateMonthlyPayroll({
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      otherAllowances: 0
    });

    expect(result.monthlyGross).toBe(0);
    expect(result.monthlyPension).toBe(0);
    expect(result.monthlyNhf).toBe(0);
    expect(result.monthlyTax).toBe(0);
    expect(result.monthlyNet).toBe(0);
  });

  test('should calculate standard employee payroll correctly', () => {
    // Inputs:
    // Basic: 100,000, Housing: 50,000, Transport: 30,000, Other: 20,000
    // Gross: 200,000/month (2.4M/year)
    // Pension Base: 180,000 -> Monthly Pension = 180,000 * 8% = 14,400 (Annual: 172,800)
    // NHF: 100,000 * 2.5% = 2,500 (Annual: 30,000)
    // CRA: Flat Math.max(200,000, 24,000) + 20% * 2.4M (480,000) = 680,000
    // Taxable Income: 2,400,000 - (172,800 + 30,000 + 680,000) = 1,517,200
    // Tax Bands:
    // - 300,000 * 7% = 21,000
    // - 300,000 * 11% = 33,000
    // - 500,000 * 15% = 75,000
    // - 417,200 * 19% = 79,268
    // Total Annual Tax: 208,268
    // Monthly Tax: 17,355.67
    // Monthly Net: 200,000 - 14,400 - 2,500 - 17,355.67 = 165,744.33
    const employee = {
      basicSalary: 100000,
      housingAllowance: 50000,
      transportAllowance: 30000,
      otherAllowances: 20000
    };

    const result = calculateMonthlyPayroll(employee);

    expect(result.monthlyGross).toBe(200000);
    expect(result.annualGross).toBe(2400000);
    expect(result.monthlyPension).toBe(14400);
    expect(result.monthlyNhf).toBe(2500);
    expect(result.annualCra).toBe(680000);
    expect(result.annualTaxableIncome).toBe(1517200);
    expect(result.annualTax).toBe(208268);
    expect(result.monthlyTax).toBe(17355.67);
    expect(result.monthlyNet).toBe(165744.33);
  });

  test('should enforce minimum tax of 1% of gross for lower incomes', () => {
    // Inputs:
    // Basic: 15,000, Housing: 4,000, Transport: 3,000, Other: 0
    // Gross: 22,000/month (264,000/year)
    // Pension Base: 22,000 -> Monthly Pension = 1,760 (Annual: 21,120)
    // NHF: 15,000 * 2.5% = 375 (Annual: 4,500)
    // CRA: 200,000 + 20% * 264,000 (52,800) = 252,800
    // Taxable Income: max(0, 264,000 - (21,120 + 4,500 + 252,800)) = 0
    // Tax before minimum check: 0
    // Minimum Tax Check: 1% of Gross = 264,000 * 1% = 2,640
    // Since 0 < 2,640, annual tax = 2,640 -> monthly tax = 220
    // Monthly Net: 22,000 - 1,760 - 375 - 220 = 19,645
    const employee = {
      basicSalary: 15000,
      housingAllowance: 4000,
      transportAllowance: 3000,
      otherAllowances: 0
    };

    const result = calculateMonthlyPayroll(employee);

    expect(result.monthlyGross).toBe(22000);
    expect(result.annualGross).toBe(264000);
    expect(result.monthlyPension).toBe(1760);
    expect(result.monthlyNhf).toBe(375);
    expect(result.annualTaxableIncome).toBe(0);
    expect(result.annualTax).toBe(2640);
    expect(result.monthlyTax).toBe(220);
    expect(result.monthlyNet).toBe(19645);
  });
});
