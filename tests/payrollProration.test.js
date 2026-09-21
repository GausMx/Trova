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

    // Progressive tax check (2026 tax bands)
    // Annual Gross: 1,680,000
    // Annual Pension: 120,960
    // Annual NHF: 21,000
    // Allowable Deductions: 120,960 + 21,000 = 141,960
    // Taxable Income: 1,680,000 - 141,960 = 1,538,040
    // PAYE (2026 bands): First 800,000 @ 0%, next 738,040 @ 15% = 110,706 annual tax
    // Monthly PAYE: 110,706 / 12 = 9,225.5
    expect(result.monthlyTax).toBe(9225.5);

    // Monthly Net: 140,000 - (10,080 + 1,750 + 9,225.5) = 118,944.5
    expect(result.monthlyNet).toBe(118944.5);
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
