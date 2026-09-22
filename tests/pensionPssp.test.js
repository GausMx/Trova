const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Disbursement = require('../models/Disbursement');
const pensionPsspService = require('../utils/pensionPsspService');
const { generateStatePayeCsv } = require('../utils/scheduleGenerator');

jest.setTimeout(30000);

describe('PenCom PSSP API & Multi-State PAYE Unit and Integration Tests', () => {
  let token;
  let companyId;
  let payrollRunId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/trova_test_pssp_multistate');
    }

    await User.deleteMany({});
    await Company.deleteMany({});
    await Employee.deleteMany({});
    await PayrollRun.deleteMany({});
    await Disbursement.deleteMany({});

    // 1. Register Company & User
    const authRes = await request(app).post('/api/auth/register').send({
      firstName: 'PenCom',
      lastName: 'Admin',
      email: 'pencom.admin@trova.ng',
      password: 'Password123!',
      companyName: 'Trova PenCom MultiState Corp',
      industry: 'FinTech'
    });

    token = authRes.body.data.token;
    companyId = authRes.body.data.user.companyId;

    // 2. Create 3 Active Employees in 3 different states (Lagos, Ogun, FCT)
    await Employee.create({
      companyId,
      firstName: 'Tunde',
      lastName: 'Bakare',
      email: 'tunde.b@trova.ng',
      basicSalary: 600000,
      housingAllowance: 200000,
      transportAllowance: 100000,
      stateOfWork: 'Lagos',
      pfaName: 'Stanbic IBTC Pension Managers',
      pfaCode: '021',
      pensionPin: 'PEN1009920102',
      tin: 'LIRS-TIN-001'
    });

    await Employee.create({
      companyId,
      firstName: 'Funke',
      lastName: 'Akindele',
      email: 'funke.a@trova.ng',
      basicSalary: 500000,
      housingAllowance: 150000,
      transportAllowance: 100000,
      stateOfWork: 'Ogun',
      pfaName: 'Leadway Pensure PFA',
      pfaCode: '001',
      pensionPin: 'PEN1008821039',
      tin: 'OGIRS-TIN-002'
    });

    await Employee.create({
      companyId,
      firstName: 'Emeka',
      lastName: 'Okafor',
      email: 'emeka.o@trova.ng',
      basicSalary: 700000,
      housingAllowance: 250000,
      transportAllowance: 150000,
      stateOfWork: 'FCT',
      pfaName: 'ARM Pension Managers',
      pfaCode: '003',
      pensionPin: 'PEN1007739102',
      tin: 'FCT-TIN-003'
    });

    // 3. Compute Draft Payroll Run
    const computeRes = await request(app)
      .post('/api/payroll/compute')
      .set('Authorization', `Bearer ${token}`)
      .send({ month: 9, year: 2026 });

    payrollRunId = computeRes.body.data.run._id;

    // 4. Approve Payroll Run
    await request(app)
      .post(`/api/payroll/${payrollRunId}/approve`)
      .set('Authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('Unit Test: buildMasterPensionPayload should build PenCom JSON payload adhering to spec', async () => {
    const run = await PayrollRun.findById(payrollRunId).populate('employees.employeeId');
    const company = await Company.findById(companyId);

    const { payload, validationErrors } = pensionPsspService.buildMasterPensionPayload(run, company);

    expect(payload.period_month).toBe('09');
    expect(payload.period_year).toBe('2026');
    expect(payload.employees.length).toBe(3);
    expect(validationErrors.length).toBe(0);

    const emp1 = payload.employees.find((e) => e.pfa_code === '021');
    expect(emp1.rsa_pin).toBe('PEN1009920102');
    expect(emp1.employee_contribution).toBeGreaterThan(0);
    expect(emp1.employer_contribution).toBeGreaterThan(0);
  });

  test('Unit Test: generateStatePayeCsv should generate state-specific CSV with mandatory fields', async () => {
    const run = await PayrollRun.findById(payrollRunId).populate('employees.employeeId');

    const lagosCsv = generateStatePayeCsv(run, 'Lagos');
    expect(lagosCsv.recordCount).toBe(1);
    expect(lagosCsv.content).toContain('Employee Full Name');
    expect(lagosCsv.content).toContain('Tunde Bakare');
    expect(lagosCsv.content).toContain('LIRS-TIN-001');

    const ogunCsv = generateStatePayeCsv(run, 'Ogun');
    expect(ogunCsv.recordCount).toBe(1);
    expect(ogunCsv.content).toContain('Funke Akindele');
    expect(ogunCsv.content).toContain('OGIRS-TIN-002');
  });

  test('API Test: POST /api/disbursements/payroll/:id/validate-pension - Should validate pension schedule and return batch token', async () => {
    const res = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/validate-pension`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pspBatchToken).toBeDefined();
    expect(res.body.data.pspBatchToken).toContain('PNC-202609');
    expect(res.body.data.pspValidationStatus).toBe('VALIDATED');

    // Verify DB updated
    const updatedRun = await PayrollRun.findById(payrollRunId);
    expect(updatedRun.PspValidationStatus).toBe('VALIDATED');
    expect(updatedRun.PspBatchToken).toBe(res.body.data.pspBatchToken);
  });

  test('API Test: GET /api/disbursements/payroll/:id/schedules/paye?state=Ogun - Should download Ogun PAYE CSV', async () => {
    const res = await request(app)
      .get(`/api/disbursements/payroll/${payrollRunId}/schedules/paye?state=Ogun`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('Funke Akindele');
    expect(res.text).toContain('OGIRS-TIN-002');
  });

  test('API Test: POST /api/disbursements/payroll/:id/generate-rrr - Should enforce State Bill Reference validation for each state', async () => {
    // Attempt generating RRR without providing bill references for all 3 states
    const failRes = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/generate-rrr`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMode: 'unified',
        stateBillReferences: { Lagos: 'LIRS-100' } // Missing Ogun and FCT
      });

    expect(failRes.status).toBe(400);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.message).toContain('State Bill Reference');

    // Success with all 3 state bill references provided
    const successRes = await request(app)
      .post(`/api/disbursements/payroll/${payrollRunId}/generate-rrr`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMode: 'unified',
        stateBillReferences: {
          Lagos: 'LIRS-10099',
          Ogun: 'OGIRS-20088',
          FCT: 'FCT-DIN-30077'
        }
      });

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.disbursement.rrrs.length).toBe(1);
    expect(successRes.body.data.disbursement.pspBatchToken).toBeDefined();
  });
});
