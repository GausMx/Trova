const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');

describe('Employee CRUD & Multi-Tenancy Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-employee-test';
  
  // Tenant A context
  let companyAToken;
  let companyAId;
  let employeeAId;

  // Tenant B context
  let companyBToken;
  let companyBId;

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

    // 1. Setup Tenant A
    const registerARes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Lagos Traders',
        industry: 'Retail',
        firstName: 'Ade',
        lastName: 'Balogun',
        email: 'ade@lagostraders.com',
        password: 'adePassword123'
      });
    companyAToken = registerARes.body.data.token;
    companyAId = registerARes.body.data.company._id;

    // Create a sample employee for Tenant A
    const empA = await Employee.create({
      companyId: companyAId,
      firstName: 'Kemi',
      lastName: 'Adeleke',
      email: 'kemi@lagostraders.com',
      basicSalary: 80000,
      housingAllowance: 30000,
      transportAllowance: 20000
    });
    employeeAId = empA._id;

    // 2. Setup Tenant B
    const registerBRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Kano Textiles',
        industry: 'Textiles',
        firstName: 'Aliyu',
        lastName: 'Ibrahim',
        email: 'aliyu@kanotextiles.com',
        password: 'aliyuPassword123'
      });
    companyBToken = registerBRes.body.data.token;
    companyBId = registerBRes.body.data.company._id;
  });

  describe('Employee Creation & Validation', () => {
    test('should create employee for Tenant A and auto-generate clean staffId', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          firstName: 'Seyi',
          lastName: 'Sowore',
          email: 'seyi@lagostraders.com',
          basicSalary: 95000,
          housingAllowance: 40000,
          transportAllowance: 30000,
          bankName: 'GTBank',
          accountNumber: '0123456789',
          accountName: 'Seyi Sowore'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.firstName).toBe('Seyi');
      // Verify generated staff ID format (first 3 chars of company name uppercased + sequence 002 since 001 exists)
      expect(res.body.data.employee.staffId).toBe('LAG-002');
    });

    test('should reject creation if email is a duplicate within the same company', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          firstName: 'Kemi',
          lastName: 'Duplicate',
          email: 'kemi@lagostraders.com', // Duplicate
          basicSalary: 50000
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    test('should reject registration if Nigerian NUBAN account number is not exactly 10 digits', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          firstName: 'Babajide',
          lastName: 'Sanwo',
          basicSalary: 120000,
          accountNumber: '12345' // Too short
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors.some(e => e.path === 'accountNumber')).toBe(true);
    });
  });

  describe('Employee Read and Tenant Separation', () => {
    test('should list Tenant A employees, but not Tenant B employees', async () => {
      // Create Tenant B employee
      await Employee.create({
        companyId: companyBId,
        firstName: 'Aminu',
        lastName: 'Gano',
        basicSalary: 150000
      });

      // Tenant A requests employees
      const resA = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(resA.body.success).toBe(true);
      expect(resA.body.data.employees.length).toBe(1);
      expect(resA.body.data.employees[0].firstName).toBe('Kemi');

      // Tenant B requests employees
      const resB = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${companyBToken}`)
        .expect(200);

      expect(resB.body.success).toBe(true);
      expect(resB.body.data.employees.length).toBe(1);
      expect(resB.body.data.employees[0].firstName).toBe('Aminu');
    });

    test('should refuse Tenant B from accessing Tenant A employee by ID', async () => {
      const res = await request(app)
        .get(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${companyBToken}`) // Requests Tenant A's employee
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Employee not found');
    });
  });

  describe('Employee Updates & Soft-deletion', () => {
    test('should allow updating active employee details', async () => {
      const res = await request(app)
        .put(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .send({
          basicSalary: 90000,
          housingAllowance: 35000
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.basicSalary).toBe(90000);
      expect(res.body.data.employee.housingAllowance).toBe(35000);
    });

    test('should soft-delete employee by marking them terminated', async () => {
      const res = await request(app)
        .delete(`/api/employees/${employeeAId}`)
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('terminated');

      // Verify that employee is still in the database
      const dbEmp = await Employee.findById(employeeAId);
      expect(dbEmp).toBeDefined();
      expect(dbEmp.status).toBe('terminated');

      // Verify that they are excluded from the default employees list endpoint
      const listRes = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${companyAToken}`)
        .expect(200);

      expect(listRes.body.data.employees.length).toBe(0);
    });
  });
});
