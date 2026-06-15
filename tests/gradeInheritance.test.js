const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const SalaryGrade = require('../models/SalaryGrade');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');

describe('Salary Grade Inheritance & Overrides API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-grade-inheritance-test';
  let ownerToken;
  let financeToken;
  let hrToken;
  let companyId;
  let testGradeId;
  let testEmployeeId;

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
    await SalaryGrade.deleteMany({});
    await Employee.deleteMany({});
    await PayrollRun.deleteMany({});

    // 1. Register Owner
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Stark Enterprises',
        industry: 'Energy',
        firstName: 'Tony',
        lastName: 'Stark',
        email: 'tony@stark.corp',
        password: 'starkPassword123'
      });

    ownerToken = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;

    // 2. Create HR and Finance Users
    await User.create({
      companyId,
      firstName: 'Pepper',
      lastName: 'Potts',
      email: 'pepper@stark.corp',
      password: 'pepperPassword123',
      role: 'hr'
    });

    await User.create({
      companyId,
      firstName: 'Happy',
      lastName: 'Hogan',
      email: 'happy@stark.corp',
      password: 'happyPassword123',
      role: 'finance'
    });

    const hrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pepper@stark.corp', password: 'pepperPassword123' });
    hrToken = hrLogin.body.data.token;

    const financeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'happy@stark.corp', password: 'happyPassword123' });
    financeToken = financeLogin.body.data.token;

    // 3. Create a default salary grade
    const grade = await SalaryGrade.create({
      companyId,
      name: 'Engineering Grade A',
      level: 2,
      basicSalary: 500000,
      housingAllowance: 200000,
      transportAllowance: 100000,
      otherAllowances: 50000,
      description: 'Senior Engineers'
    });
    testGradeId = grade._id;

    // 4. Create an employee assigned to the grade (no manual salary fields provided)
    const empRes = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Peter',
        lastName: 'Parker',
        email: 'peter.parker@dailybugle.test',
        phone: '08012345678',
        gradeId: testGradeId.toString()
      });
    testEmployeeId = empRes.body.data.employee._id;
  });

  describe('Salary Grade CRUD & Inheritance', () => {
    test('should allow owner/hr to create salary grades', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          name: 'Management Level 1',
          level: 4,
          basicSalary: 1000000,
          housingAllowance: 400000,
          transportAllowance: 200000,
          otherAllowances: 100000,
          description: 'C-Suite Directors'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.grade.name).toBe('Management Level 1');
      expect(res.body.data.grade.grossSalary).toBe(1700000);
    });

    test('should prevent duplicates of grade names in the same company', async () => {
      const res = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Engineering Grade A',
          basicSalary: 300000
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });

    test('should inherit salary grade figures correctly on employee creation', async () => {
      const res = await request(app)
        .get(`/api/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.employee.salaryOverridden).toBe(false);
      expect(res.body.data.employee.basicSalary).toBe(500000);
      expect(res.body.data.employee.housingAllowance).toBe(200000);
      expect(res.body.data.employee.gradeData).toBeDefined();
      expect(res.body.data.employee.gradeData.name).toBe('Engineering Grade A');
      expect(res.body.data.employee.salaryDiffersFromGrade).toBe(false);
    });

    test('should pull grade figures correctly during payroll computation', async () => {
      const res = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ month: 6, year: 2026 });

      expect(res.status).toBe(201);
      const computedEmp = res.body.data.run.employees[0];
      expect(computedEmp.basicSalary).toBe(500000);
      expect(computedEmp.housingAllowance).toBe(200000);
      expect(computedEmp.grossSalary).toBe(850000);
    });
  });

  describe('Salary Overrides & Reset Workflows', () => {
    test('should automatically set salaryOverridden: true when manual updates occur', async () => {
      const updateRes = await request(app)
        .put(`/api/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ basicSalary: 550000 }); // manual change

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.employee.salaryOverridden).toBe(true);
      expect(updateRes.body.data.employee.basicSalary).toBe(550000);

      // Verify detailed get returns differences flag
      const getRes = await request(app)
        .get(`/api/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(getRes.body.data.employee.salaryDiffersFromGrade).toBe(true);

      // Verify subsequent payroll run calculations use the overrides, not the grade
      const computeRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ month: 6, year: 2026 });

      const empInRun = computeRes.body.data.run.employees[0];
      expect(empInRun.basicSalary).toBe(550000);
      expect(empInRun.housingAllowance).toBe(200000); // untouched housing still copied
    });

    test('should reset overridden figures back to grade default figures successfully', async () => {
      // 1. Create override
      await request(app)
        .put(`/api/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ basicSalary: 600000 });

      // 2. Perform reset
      const resetRes = await request(app)
        .put(`/api/employees/${testEmployeeId}/reset-salary`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send();

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.employee.salaryOverridden).toBe(false);
      expect(resetRes.body.data.employee.basicSalary).toBe(500000);

      // 3. Confirm get details matches grade
      const getRes = await request(app)
        .get(`/api/employees/${testEmployeeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.body.data.employee.salaryDiffersFromGrade).toBe(false);
    });

    test('should verify grade updates do not retroactively alter draft or approved historical payroll runs', async () => {
      // 1. Compute draft run
      await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ month: 6, year: 2026 });

      // 2. Modify grade salary figures
      await request(app)
        .put(`/api/grades/${testGradeId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ basicSalary: 600000 });

      // 3. Retrieve draft run and verify basicSalary is still 500000 (SNAPSHOT IMMUTABILITY)
      const runsRes = await request(app)
        .get('/api/payroll')
        .set('Authorization', `Bearer ${financeToken}`);
      const runId = runsRes.body.data.runs[0]._id;

      const runDetails = await request(app)
        .get(`/api/payroll/${runId}`)
        .set('Authorization', `Bearer ${financeToken}`);

      const empInRun = runDetails.body.data.run.employees[0];
      expect(empInRun.basicSalary).toBe(500000); // unaffected by grade change!
    });
  });
});
