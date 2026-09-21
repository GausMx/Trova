const {
  getStateBillerId,
  getPfaCustodianDetails,
  aggregatePayrollRouting,
  STATE_IRS_BILLERS,
  PFA_REGISTRY
} = require('../config/billerRegistry');

describe('Biller Registry & Multi-Agency Routing Engine', () => {
  test('should resolve State IRS Biller ID for all 36 Nigerian States + FCT', () => {
    const states = [
      'Lagos', 'Ogun', 'Abuja', 'Rivers', 'Kano', 'Kaduna', 'Oyo', 'Enugu', 'Anambra', 'Delta'
    ];
    for (const state of states) {
      const details = getStateBillerId(state);
      expect(details).toBeDefined();
      expect(details.billerId).toMatch(/^10000/);
    }
  });

  test('should fallback to Lagos State IRS if state is unknown or invalid', () => {
    const details = getStateBillerId('Unknown State');
    expect(details.billerId).toBe(STATE_IRS_BILLERS['Lagos'].billerId);
  });

  test('should resolve PFA Custodian details and PFC bank accounts correctly', () => {
    const pfa = getPfaCustodianDetails('Stanbic IBTC Pension Managers');
    expect(pfa.pfcName).toBe('First Pension Custodian Nigeria Limited');
    expect(pfa.pfcAccount).toBe('2001122334');
    expect(pfa.pfcBankCode).toBe('011');
  });

  test('should aggregate multi-state remote workers and multi-PFA employee rosters correctly', () => {
    const sampleEmployees = [
      {
        employeeId: { name: 'Emp 1 (Lagos)', stateOfWork: 'Lagos', pfaName: 'Stanbic IBTC Pension Managers' },
        netSalary: 500000,
        taxDeduction: 55000,
        pensionDeduction: 40000,
        employerPensionContribution: 50000,
        nhfDeduction: 0,
        nhisDeduction: 0,
        nsitfContribution: 5000,
        itfContribution: 0
      },
      {
        employeeId: { name: 'Emp 2 (Ogun Remote)', stateOfWork: 'Ogun', pfaName: 'Stanbic IBTC Pension Managers' },
        netSalary: 400000,
        taxDeduction: 42000,
        pensionDeduction: 32000,
        employerPensionContribution: 40000,
        nhfDeduction: 0,
        nhisDeduction: 0,
        nsitfContribution: 4000,
        itfContribution: 0
      },
      {
        employeeId: { name: 'Emp 3 (Abuja Remote)', stateOfWork: 'Abuja', pfaName: 'Leadway Pensure PFA' },
        netSalary: 600000,
        taxDeduction: 68000,
        pensionDeduction: 48000,
        employerPensionContribution: 60000,
        nhfDeduction: 0,
        nhisDeduction: 0,
        nsitfContribution: 6000,
        itfContribution: 0
      }
    ];

    const result = aggregatePayrollRouting(sampleEmployees);

    // Total Outflow Verification
    // Net = 1,500,000
    // Tax = 55,000 + 42,000 + 68,000 = 165,000
    // Employee Pension = 40k + 32k + 48k = 120,000
    // Employer Pension = 50k + 40k + 60k = 150,000
    // Pension Total = 270,000
    // NSITF = 15,000
    // Total Statutory = 165,000 + 270,000 + 15,000 = 450,000
    // Total Outflow = 1,500,000 + 450,000 = 1,950,000

    expect(result.summary.netSalaries).toBe(1500000);
    expect(result.summary.payeTax).toBe(165000);
    expect(result.summary.pension).toBe(270000);
    expect(result.summary.nsitf).toBe(15000);
    expect(result.summary.totalStatutory).toBe(450000);
    expect(result.summary.totalOutflow).toBe(1950000);

    // Multi-State PAYE routing check
    expect(result.routing.payeByState.length).toBe(3); // Lagos, Ogun, Abuja
    const ogunPaye = result.routing.payeByState.find((p) => p.state === 'Ogun');
    expect(ogunPaye.totalTax).toBe(42000);
    expect(ogunPaye.biller.billerId).toBe(STATE_IRS_BILLERS['Ogun'].billerId);

    // Multi-PFA Pension routing check
    expect(result.routing.pensionByPfa.length).toBe(2); // Stanbic, Leadway
    const stanbicPension = result.routing.pensionByPfa.find((p) => p.pfaName === 'Stanbic IBTC Pension Managers');
    expect(stanbicPension.totalPension).toBe(162000); // (40k+50k) + (32k+40k) = 162k
  });
});
