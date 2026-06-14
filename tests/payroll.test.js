const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
jest.mock('../utils/payslipGenerator', () => ({
  generatePayslipPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf content'))
}));
const PayrollRun = require('../models/PayrollRun');


describe('Payroll Execution API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-payroll-test';
  
  let companyAToken;
  let companyAId;
  let companyBToken;
  let employeeId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testMongoUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Company.deleteMany({});
    await Employee.deleteMany({});
    await PayrollRun.deleteMany({});

    // 1. Setup Tenant A
    const registerARes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Gbagada Ventures',
        industry: 'Logistics',
        firstName: 'Femi',
        lastName: 'Otedola',
        email: 'femi@gbagada.ng',
        password: 'femiPassword123'
      });
    companyAToken = registerARes.body.data.token;
    companyAId = registerARes.body.data.company._id;

    // Create an employee for Tenant A
    // Monthly Basic: 100,000, Housing: 50,000, Transport: 30,000, Other: 20,000
    // Gross: 200,000
    const emp = await Employee.create({
      companyId: companyAId,
      firstName: 'Aliko',
      lastName: 'Dangote',
      email: 'aliko@gbagada.ng',
      basicSalary: 100000,
      housingAllowance: 50000,
      transportAllowance: 30000,
      otherAllowances: 20000
    });
    employeeId = emp._id;

    // 2. Setup Tenant B
    const registerBRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Ikeja Merchants',
        industry: 'Commerce',
        firstName: 'Bola',
        lastName: 'Tinubu',
        email: 'bola@ikeja.ng',
        password: 'bolaPassword123'
      });
    companyBToken = registerBRes.body.data.token;
  });

  describe('Payroll Calculation Pipeline', () => {
    test('should calculate a draft payroll run and save it', async () => {
      const res = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          month: 6,
          year: 2026
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.run.status).toBe('draft');
      expect(res.body.data.run.month).toBe(6);
      expect(res.body.data.run.year).toBe(2026);
      
      // Verify calculations totals:
      // Gross: 200,000
      // Pension: 8% of B+H+T (180,000) = 14,400
      // NHF: 2.5% of Basic (100,000) = 2,500
      // Tax (PAYE): 17,355.67 (verified in unit tests)
      // Net: 200,000 - 14,400 - 2,500 - 17,355.67 = 165,744.33
      expect(res.body.data.run.totals.gross).toBe(200000);
      expect(res.body.data.run.totals.pension).toBe(14400);
      expect(res.body.data.run.totals.nhf).toBe(2500);
      expect(res.body.data.run.totals.tax).toBe(17355.67);
      expect(res.body.data.run.totals.net).toBe(165744.33);

      expect(res.body.data.run.employees.length).toBe(1);
      expect(res.body.data.run.employees[0].name).toBe('Aliko Dangote');
    });

    test('should approve draft payroll run and lock it from recalculation', async () => {
      // 1. Calculate draft
      const draftRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({ month: 6, year: 2026 });
      const runId = draftRes.body.data.run._id;

      // 2. Approve run
      const approveRes = await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.run.status).toBe('approved');

      // 3. Attempt recalculating must fail
      const recalculateRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({ month: 6, year: 2026 })
        .expect(400);

      expect(recalculateRes.body.success).toBe(false);
      expect(recalculateRes.body.message).toContain('already approved');
    });

    test('should pay approved payroll run and lock it from further change', async () => {
      // 1. Setup approved run
      const draftRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({ month: 6, year: 2026 });
      const runId = draftRes.body.data.run._id;

      await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`);

      // 2. Pay payroll
      const payRes = await request(app)
        .post(`/api/payroll/${runId}/pay`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(payRes.body.success).toBe(true);
      expect(payRes.body.data.run.status).toBe('paid');

      // 3. Attempting to approve again should fail
      const approveAgainRes = await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(400);

      expect(approveAgainRes.body.success).toBe(false);
      expect(approveAgainRes.body.message).toContain('already paid');
    });
  });

  describe('Payroll Access Scoping', () => {
    test('should refuse Tenant B from approving Tenant A\'s draft payroll run', async () => {
      // 1. Calculate Tenant A draft
      const draftRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({ month: 6, year: 2026 });
      const runId = draftRes.body.data.run._id;

      // 2. Tenant B attempts to approve
      const res = await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Payroll run not found');
    });
  });

  describe('GET /api/payroll/:id/payslip/:employeeId', () => {
    let runId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({ month: 6, year: 2026 });
      runId = res.body.data.run._id;
    });

    test('should generate and stream PDF payslip with correct headers', async () => {
      const res = await request(app)
        .get(`/api/payroll/${runId}/payslip/${employeeId}`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('payslip_');
      
      const pdfBuffer = res.body;
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    test('should reject request from unauthorized tenant (Tenant B)', async () => {
      const res = await request(app)
        .get(`/api/payroll/${runId}/payslip/${employeeId}`)
        .set('Authorization', `Bearer ${companyBToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Payroll run not found');
    });

    test('should reject if employee does not exist in the run', async () => {
      const nonExistentEmpId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/payroll/${runId}/payslip/${nonExistentEmpId}`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Employee payroll record not found');
    });
  });
});
