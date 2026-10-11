const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Company = require('../models/Company');
const User = require('../models/User');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Disbursement = require('../models/Disbursement');
const ComplianceRecord = require('../models/ComplianceRecord');
const { PAYROLL_STATUS } = require('../config/constants');

jest.setTimeout(30000);

describe('Monthly Payroll Reconciliation & Audit Trail API Tests', () => {
  let token;
  let companyId;
  let payrollRunId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trova_test_reconciliation');
    }

    await User.deleteMany({});
    await Company.deleteMany({});
    await Employee.deleteMany({});
    await PayrollRun.deleteMany({});
    await Disbursement.deleteMany({});
    await ComplianceRecord.deleteMany({});

    // Register company & owner
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Reconciliation Test Corp ' + Date.now(),
        firstName: 'Audit',
        lastName: 'Director',
        email: `audit_${Date.now()}@testcorp.ng`,
        password: 'password123'
      });

    token = res.body.data.token;
    companyId = res.body.data.user.companyId;

    // Create active employees with varying states
    await Employee.create({
      companyId,
      staffId: 'REC-001',
      firstName: 'Tunde',
      lastName: 'Adeleke',
      basicSalary: 300000,
      housingAllowance: 100000,
      transportAllowance: 50000,
      otherAllowances: 20000,
      stateOfWork: 'Lagos',
      pfaName: 'Stanbic IBTC Pension Managers',
      pensionPin: 'PEN100234567890',
      tin: 'TIN-100293',
      accountNumber: '0123456789',
      bankName: 'GTBank',
      status: 'active'
    });

    await Employee.create({
      companyId,
      staffId: 'REC-002',
      firstName: 'Ngozi',
      lastName: 'Okafor',
      basicSalary: 400000,
      housingAllowance: 150000,
      transportAllowance: 60000,
      otherAllowances: 30000,
      stateOfWork: 'Ogun',
      pfaName: 'ARM Pension Managers',
      pensionPin: 'PEN100987654321',
      tin: 'TIN-992014',
      accountNumber: '0987654321',
      bankName: 'Zenith Bank',
      status: 'active'
    });

    // Compute payroll
    const computeRes = await request(app)
      .post('/api/payroll/compute')
      .set('Authorization', `Bearer ${token}`)
      .send({ month: 6, year: 2026 });

    payrollRunId = computeRes.body.data.run._id;

    // Approve payroll
    await request(app)
      .post(`/api/payroll/${payrollRunId}/approve`)
      .set('Authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('GET /api/payroll/:id/reconciliation - Should return numbers check and mathematical zero-variance proof', async () => {
    const res = await request(app)
      .get(`/api/payroll/${payrollRunId}/reconciliation`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { headcountAndAttendance, financialBalancing, period, auditTrail } = res.body.data;

    // Headcount check
    expect(headcountAndAttendance.totalEmployees).toBe(2);
    expect(headcountAndAttendance.workingDaysInMonth).toBeGreaterThan(0);

    // Mathematical balance check
    expect(financialBalancing.isMathematicallyBalanced).toBe(true);
    expect(Math.abs(financialBalancing.clearingVariance)).toBeLessThanOrEqual(0.05);

    // Audit trail should contain COMPUTED and APPROVED events
    expect(auditTrail.length).toBeGreaterThanOrEqual(2);
    const eventTypes = auditTrail.map(e => e.event);
    expect(eventTypes).toContain('COMPUTED');
    expect(eventTypes).toContain('APPROVED');
  });

  it('POST /api/disbursements/payroll/:id/generate-rrr - Should record RRR_GENERATED in audit trail', async () => {
    const res = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/generate-rrr`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMode: 'unified',
        stateBillReferences: {
          Lagos: 'LIRS-DIN-100234',
          Ogun: 'OGIRS-DIN-99201'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.disbursement.rrrs.length).toBe(1);

    // Verify audit trail updated
    const reconRes = await request(app)
      .get(`/api/payroll/${payrollRunId}/reconciliation`)
      .set('Authorization', `Bearer ${token}`);

    const events = reconRes.body.data.auditTrail.map(e => e.event);
    expect(events).toContain('RRR_GENERATED');
  });

  it('POST /api/disbursements/payroll/:id/simulate-payment - Should trigger sandbox settlement and record PAYMENT_SETTLED', async () => {
    const simRes = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/simulate-payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(simRes.status).toBe(200);
    expect(simRes.body.success).toBe(true);

    // Verify payroll run is now marked as PAID and audit trail records PAYMENT_SETTLED
    const reconRes = await request(app)
      .get(`/api/payroll/${payrollRunId}/reconciliation`)
      .set('Authorization', `Bearer ${token}`);

    expect(reconRes.body.data.period.status).toBe(PAYROLL_STATUS.PAID);
    expect(reconRes.body.data.period.settlementReference).toBeDefined();

    const events = reconRes.body.data.auditTrail.map(e => e.event);
    expect(events).toContain('PAYMENT_SETTLED');
  });
});
