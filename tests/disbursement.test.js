const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Disbursement = require('../models/Disbursement');
const ComplianceRecord = require('../models/ComplianceRecord');
const StatutoryCalendar = require('../models/StatutoryCalendar');
const seedStatutoryDeadlines = require('../config/seeder');

jest.setTimeout(30000);

describe('Disbursements & Remita RRR Workflow API Tests', () => {
  let token;
  let companyId;
  let userId;
  let payrollRunId;
  let employeeId1;
  let employeeId2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/trova_test_disbursements');
    }

    await User.deleteMany({});
    await Company.deleteMany({});
    await Employee.deleteMany({});
    await PayrollRun.deleteMany({});
    await Disbursement.deleteMany({});
    await ComplianceRecord.deleteMany({});
    await StatutoryCalendar.deleteMany({});

    // Seed statutory calendar items
    await seedStatutoryDeadlines();

    // 1. Register Owner & Company
    const authRes = await request(app).post('/api/auth/register').send({
      firstName: 'Disburse',
      lastName: 'Admin',
      email: 'disburse.admin@trova.ng',
      password: 'Password123!',
      companyName: 'Trova Disbursement Corp',
      industry: 'FinTech'
    });

    token = authRes.body.data.token;
    companyId = authRes.body.data.user.companyId;
    userId = authRes.body.data.user._id;

    // 2. Create 2 Active Employees (1 Lagos, 1 Ogun Remote)
    const emp1 = await Employee.create({
      companyId,
      firstName: 'Ade',
      lastName: 'Bello',
      email: 'ade.bello@trova.ng',
      basicSalary: 600000,
      housingAllowance: 250000,
      transportAllowance: 150000,
      stateOfWork: 'Lagos',
      pfaName: 'Stanbic IBTC Pension Managers',
      pensionPin: 'PEN-1001',
      tin: 'TIN-9001',
      bankName: 'GTBank',
      accountNumber: '0123456789'
    });

    const emp2 = await Employee.create({
      companyId,
      firstName: 'Chioma',
      lastName: 'Okoro',
      email: 'chioma.okoro@trova.ng',
      basicSalary: 500000,
      housingAllowance: 200000,
      transportAllowance: 100000,
      stateOfWork: 'Ogun',
      pfaName: 'Leadway Pensure PFA',
      pensionPin: 'PEN-2002',
      tin: 'TIN-9002',
      bankName: 'Zenith Bank',
      accountNumber: '9876543210'
    });

    employeeId1 = emp1._id;
    employeeId2 = emp2._id;

    // 3. Compute Draft Payroll Run for June 2026
    const computeRes = await request(app)
      .post('/api/payroll/compute')
      .set('Authorization', `Bearer ${token}`)
      .send({ month: 6, year: 2026 });

    payrollRunId = computeRes.body.data.run._id;

    // 4. Approve Payroll Run
    await request(app)
      .post(`/api/payroll/${payrollRunId}/approve`)
      .set('Authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('GET /api/disbursements/payroll/:id/summary - Should return financial breakdown and multi-agency routing', async () => {
    const res = await request(app)
      .get(`/api/disbursements/payroll/${payrollRunId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const summary = res.body.data.summary;
    expect(summary.netSalaries).toBeGreaterThan(0);
    expect(summary.payeTax).toBeGreaterThan(0);
    expect(summary.pension).toBeGreaterThan(0);
    expect(summary.totalOutflow).toBe(summary.netSalaries + summary.totalStatutory);

    // Multi-agency routing metadata check
    const routing = res.body.data.routing;
    expect(routing.payeByState.length).toBe(2); // Lagos & Ogun
    expect(routing.pensionByPfa.length).toBe(2); // Stanbic & Leadway
  });

  test('POST /api/disbursements/payroll/:id/generate-rrr - Should generate Master Unified RRR (Option A)', async () => {
    const res = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/generate-rrr`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMode: 'unified',
        stateBillReferences: { Lagos: 'LIRS-100', Ogun: 'OGIRS-200' }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const disbursement = res.body.data.disbursement;
    expect(disbursement.paymentMode).toBe('unified');
    expect(disbursement.rrrs.length).toBe(1);
    expect(disbursement.rrrs[0].category).toBe('master');
    expect(disbursement.rrrs[0].rrr).toBeDefined();
    expect(disbursement.rrrs[0].status).toBe('generated');
  });

  test('POST /api/disbursements/payroll/:id/generate-rrr - Should generate Split RRRs (Option B)', async () => {
    const res = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/generate-rrr`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMode: 'split',
        stateBillReferences: { Lagos: 'LIRS-100', Ogun: 'OGIRS-200' }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const disbursement = res.body.data.disbursement;
    expect(disbursement.paymentMode).toBe('split');
    expect(disbursement.rrrs.length).toBe(2); // Net Salaries RRR & Statutory RRR
    expect(disbursement.rrrs[0].category).toBe('salaries');
    expect(disbursement.rrrs[1].category).toBe('statutory_unified');
  });

  test('GET /api/disbursements/payroll/:id/schedules/taxpro-max - Should stream TaxPro Max PAYE CSV', async () => {
    const res = await request(app)
      .get(`/api/disbursements/payroll/${payrollRunId}/schedules/taxpro-max`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('Employee TIN');
    expect(res.text).toContain('TIN-9001');
    expect(res.text).toContain('Lagos');
    expect(res.text).toContain('Ogun');
  });

  test('GET /api/disbursements/payroll/:id/schedules/pencom - Should stream PenCom Excel schedule', async () => {
    const res = await request(app)
      .get(`/api/disbursements/payroll/${payrollRunId}/schedules/pencom`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('spreadsheetml');
  });

  test('POST /api/webhooks/remita - Should handle 00 success callback, auto-mark Payroll PAID, and update ComplianceRecord', async () => {
    // 1. Fetch RRR from disbursement record
    const summaryRes = await request(app)
      .get(`/api/disbursements/payroll/${payrollRunId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    const existingDisbursement = summaryRes.body.data.existingDisbursement;
    const salaryRrrItem = existingDisbursement.rrrs.find(r => r.category === 'salaries');

    // 2. Trigger webhook confirmation for Salaries RRR
    const webhookRes1 = await request(app)
      .post('/api/webhooks/remita')
      .send({
        rrr: salaryRrrItem.rrr,
        status: '00',
        paymentReference: 'REM-TEST-REF-001'
      });

    expect(webhookRes1.status).toBe(200);
    expect(webhookRes1.body.success).toBe(true);

    // Verify PayrollRun status updated to PAID
    const updatedRun = await PayrollRun.findById(payrollRunId);
    expect(updatedRun.status).toBe('paid');

    // 3. Trigger webhook confirmation for Statutory RRR
    const statRrrItem = existingDisbursement.rrrs.find(r => r.category === 'statutory_unified');
    const webhookRes2 = await request(app)
      .post('/api/webhooks/remita')
      .send({
        rrr: statRrrItem.rrr,
        status: '00',
        paymentReference: 'REM-TEST-REF-002'
      });

    expect(webhookRes2.status).toBe(200);

    // Verify ComplianceRecords updated to completed
    const records = await ComplianceRecord.find({ companyId, month: 7, year: 2026 });
    for (const rec of records) {
      expect(rec.status).toBe('completed');
      expect(rec.notes).toContain('Auto-reconciled via Remita RRR');
    }
  });
});
