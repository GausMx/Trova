const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const XLSX = require('xlsx');

describe('Payroll Bulk Payment File Generation Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-payment-file-test';
  
  let companyAToken;
  let companyAId;
  let companyBToken;
  let companyBId;
  
  let employee1; // Valid bank details
  let employee2; // Invalid bank name (returns warning, bankCode empty)
  let employee3; // Missing bank details (excluded)

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
        companyName: 'Lekki Tech',
        industry: 'Software',
        firstName: 'Tunde',
        lastName: 'Bakare',
        email: 'tunde@lekkitech.ng',
        password: 'tundePassword123'
      });
    companyAToken = registerARes.body.data.token;
    companyAId = registerARes.body.data.company._id;

    // 2. Setup Tenant B
    const registerBRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Victoria Trade',
        industry: 'Logistics',
        firstName: 'Sani',
        lastName: 'Abacha',
        email: 'sani@victrade.ng',
        password: 'saniPassword123'
      });
    companyBToken = registerBRes.body.data.token;
    companyBId = registerBRes.body.data.company._id;
  });

  describe('Employee Bank Details Validation & Code Auto-population', () => {
    test('should auto-populate bank code when bankName exists in BANK_CODES', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          firstName: 'Amina',
          lastName: 'Bello',
          email: 'amina@lekkitech.ng',
          basicSalary: 120000,
          bankName: 'GTBank',
          accountNumber: '0123456789',
          accountName: 'Amina Bello'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.bankCode).toBe('058');
      expect(res.body.data.warning).toBeUndefined();
    });

    test('should store bankName as-is, leave bankCode blank, and return warning if bankName is not in BANK_CODES', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          firstName: 'Chidi',
          lastName: 'Okeke',
          email: 'chidi@lekkitech.ng',
          basicSalary: 110000,
          bankName: 'Custom Fintech Bank',
          accountNumber: '9876543210',
          accountName: 'Chidi Okeke'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.bankName).toBe('Custom Fintech Bank');
      expect(res.body.data.employee.bankCode).toBe('');
      expect(res.body.data.warning).toBe('Bank code not found for this bank — please enter manually.');
    });
  });

  describe('CSV & Excel Payment File Generation', () => {
    let runId;

    beforeEach(async () => {
      // Create three employees for Tenant A
      // Employee 1: Valid bank details
      employee1 = await Employee.create({
        companyId: companyAId,
        firstName: 'Amina',
        lastName: 'Bello',
        email: 'amina@lekkitech.ng',
        basicSalary: 120000,
        bankName: 'GTBank',
        bankCode: '058',
        accountNumber: '0123456789',
        accountName: 'Amina Bello'
      });

      // Employee 2: Warning bank (should still generate row, but bankCode empty)
      employee2 = await Employee.create({
        companyId: companyAId,
        firstName: 'Chidi',
        lastName: 'Okeke',
        email: 'chidi@lekkitech.ng',
        basicSalary: 110000,
        bankName: 'Custom Fintech Bank',
        bankCode: '',
        accountNumber: '9876543210',
        accountName: 'Chidi Okeke'
      });

      // Employee 3: Missing bank details entirely (excluded from payment file)
      employee3 = await Employee.create({
        companyId: companyAId,
        firstName: 'Obi',
        lastName: 'Eze',
        email: 'obi@lekkitech.ng',
        basicSalary: 90000
      });

      // Compute draft payroll run
      const computeRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          month: 6,
          year: 2026
        })
        .expect(201);

      runId = computeRes.body.data.run._id;
    });

    test('should reject downloading payment files for a DRAFT run', async () => {
      // CSV download
      const csvRes = await request(app)
        .get(`/api/payroll/${runId}/payment-file/csv`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(400);

      expect(csvRes.body.success).toBe(false);
      expect(csvRes.body.message).toContain('approved or paid');

      // Excel download
      const excelRes = await request(app)
        .get(`/api/payroll/${runId}/payment-file/excel`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(400);

      expect(excelRes.body.success).toBe(false);
      expect(excelRes.body.message).toContain('approved or paid');
    });

    test('should block download for wrong company (multi-tenancy)', async () => {
      // First, approve the payroll run
      await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      // Try to download with Tenant B's token
      await request(app)
        .get(`/api/payroll/${runId}/payment-file/csv`)
        .set('Authorization', `Bearer ${companyBToken}`)
        .expect(404); // Should return 404 since it belongs to companyA
    });

    test('should generate CSV file with correct columns, row count, and exclude employee with missing bank details', async () => {
      // Approve run
      await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      const res = await request(app)
        .get(`/api/payroll/${runId}/payment-file/csv`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('trova-salary-june-2026.csv');

      const csvText = res.text;
      const lines = csvText.trim().split('\n');

      // Expect exactly 3 lines: 1 header row + 2 employee rows (Amina, Chidi) (Obi Eze is excluded because of no bank details)
      expect(lines.length).toBe(3);

      // Verify header columns exactly in order:
      // account_number, account_name, bank_name, bank_code, amount, narration
      const expectedHeader = 'account_number,account_name,bank_name,bank_code,amount,narration';
      expect(lines[0].trim()).toBe(expectedHeader);

      // Verify Amina Bello row:
      expect(lines[1]).toContain('0123456789');
      expect(lines[1]).toContain('Amina Bello');
      expect(lines[1]).toContain('GTBank');
      expect(lines[1]).toContain('058');
      expect(lines[1]).toContain('June 2026 Salary - Amina Bello');

      // Verify Chidi Okeke row (empty bank code):
      expect(lines[2]).toContain('9876543210');
      expect(lines[2]).toContain('Chidi Okeke');
      expect(lines[2]).toContain('Custom Fintech Bank');
      expect(lines[2]).toContain('June 2026 Salary - Chidi Okeke');
    });

    test('should generate Excel file with correct columns, row count, and correct sheet name', async () => {
      // Approve run
      await request(app)
        .post(`/api/payroll/${runId}/approve`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      const res = await request(app)
        .get(`/api/payroll/${runId}/payment-file/excel`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .buffer()
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('trova-salary-june-2026.xlsx');

      // Read binary buffer using sheetjs
      const workbook = XLSX.read(res.body, { type: 'buffer' });

      // Verify sheet name: "Salary Payment June 2026"
      expect(workbook.SheetNames).toContain('Salary Payment June 2026');

      const worksheet = workbook.Sheets['Salary Payment June 2026'];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      // Expect exactly 2 rows (excluding headers)
      expect(rows.length).toBe(2);

      // Row 1 values
      const row1 = rows[0];
      expect(row1.account_number).toBe('0123456789');
      expect(row1.account_name).toBe('Amina Bello');
      expect(row1.bank_name).toBe('GTBank');
      expect(row1.bank_code).toBe('058');
      expect(row1.narration).toBe('June 2026 Salary - Amina Bello');

      // Row 2 values
      const row2 = rows[1];
      expect(row2.account_number).toBe('9876543210');
      expect(row2.account_name).toBe('Chidi Okeke');
      expect(row2.bank_name).toBe('Custom Fintech Bank');
      expect(row2.bank_code).toBe(''); // Since it was empty string, sheetjs parsed JSON returns it as empty string
      expect(row2.narration).toBe('June 2026 Salary - Chidi Okeke');
    });
  });
});
