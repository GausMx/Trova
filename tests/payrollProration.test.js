const { calculateMonthlyPayroll } = require('../utils/payrollEngine');

describe('Payroll Proration Logic', () => {
  const employeeSalary = {
    basicSalary: 100000,
    housingAllowance: 50000,
    transportAllowance: 30000,
    otherAllowances: 20000
  };

  test('should return standard gross salary when no attendance proration is specified', () => {
    const result = calculateMonthlyPayroll(employeeSalary);
    expect(result.monthlyGross).toBe(200000);
    expect(result.daysAbsent).toBe(0);
    expect(result.halfDays).toBe(0);
    expect(result.daysWorked).toBe(0);
    expect(result.workingDays).toBe(0);
  });

  test('should compute correct prorated figures for 14/20 days worked', () => {
    // 20 working days, 5 days absent, 2 half days = 14 days worked (proration factor = 0.7)
    const attendance = {
      workingDaysInMonth: 20,
      daysAbsent: 5,
      halfDays: 2
    };

    const result = calculateMonthlyPayroll(employeeSalary, attendance);

    expect(result.workingDays).toBe(20);
    expect(result.daysAbsent).toBe(5);
    expect(result.halfDays).toBe(2);
    expect(result.daysWorked).toBe(14);

    // Prorated Gross: 200,000 * 0.7 = 140,000
    expect(result.monthlyGross).toBe(140000);
    expect(result.proratedGross).toBe(140000);

    // Prorated Pension: 8% of (70,000 basic + 35,000 housing + 21,000 transport) = 10,080
    expect(result.monthlyPension).toBe(10080);

    // Prorated NHF: 2.5% of 70,000 basic = 1,750
    expect(result.monthlyNhf).toBe(1750);

    // Progressive tax check
    // Annual Gross: 1,680,000
    // Annual Pension: 120,960
    // Annual NHF: 21,000
    // Annual CRA: flat (max(200k, 1.68m * 1%) + 20% of 1.68m) = 200,000 + 336,000 = 536,000
    // Taxable Income: 1,680,000 - (120,960 + 21,000 + 536,000) = 1,002,040
    // PAYE: 300,000 * 7% (21,000) + 300,000 * 11% (33,000) + 402,040 * 15% (60,306) = 114,306
    // Monthly PAYE: 114,306 / 12 = 9,525.5
    expect(result.monthlyTax).toBe(9525.5);

    // Monthly Net: 140,000 - (10,080 + 1,750 + 9,525.5) = 118,644.5
    expect(result.monthlyNet).toBe(118644.5);
  });

  test('should trigger minimum tax check correctly on prorated figures', () => {
    // low salary employee who falls into minimum tax bracket
    const lowSalaryEmployee = {
      basicSalary: 20000,
      housingAllowance: 5000,
      transportAllowance: 3000,
      otherAllowances: 2000
    };

    // 20 working days, 10 days absent = 10 days worked (0.5 proration)
    const attendance = {
      workingDaysInMonth: 20,
      daysAbsent: 10,
      halfDays: 0
    };

    const result = calculateMonthlyPayroll(lowSalaryEmployee, attendance);

    // Prorated gross: 30,000 * 0.5 = 15,000
    expect(result.monthlyGross).toBe(15000);

    // Minimum tax = 1% of gross = 1% of 15,000 = 150 NGN per month
    expect(result.monthlyTax).toBe(150);
  });
});
