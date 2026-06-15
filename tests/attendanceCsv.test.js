const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');

describe('Attendance CSV Upload API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-attendance-csv-test';
  let ownerToken;
  let financeToken;
  let companyId;
  let employeeId1;
  let employeeId2;
  let staffId1;
  let staffId2;
  let runId;

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

    // 1. Register Owner
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Daily Bugle',
        industry: 'Media',
        firstName: 'J.',
        lastName: 'Jameson',
        email: 'jjj@bugle.test',
        password: 'jjjPassword123'
      });

    ownerToken = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;

    // 2. Create Finance User
    await User.create({
      companyId,
      firstName: 'Betty',
      lastName: 'Brant',
      email: 'betty@bugle.test',
      password: 'bettyPassword123',
      role: 'finance'
    });

    const financeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'betty@bugle.test', password: 'bettyPassword123' });
    financeToken = financeLogin.body.data.token;

    // 3. Create active employees
    const emp1 = await Employee.create({
      companyId,
      firstName: 'Peter',
      lastName: 'Parker',
      email: 'peter@bugle.test',
      basicSalary: 200000,
      housingAllowance: 50000,
      transportAllowance: 30000,
      otherAllowances: 20000
    });
    employeeId1 = emp1._id;
    staffId1 = emp1.staffId;

    const emp2 = await Employee.create({
      companyId,
      firstName: 'Robbie',
      lastName: 'Robertson',
      email: 'robbie@bugle.test',
      basicSalary: 350000,
      housingAllowance: 80000,
      transportAllowance: 40000,
      otherAllowances: 30000
    });
    employeeId2 = emp2._id;
    staffId2 = emp2.staffId;

    // 4. Compute draft payroll run
    const computeRes = await request(app)
      .post('/api/payroll/compute')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ month: 6, year: 2026 });
    runId = computeRes.body.data.run._id;
  });

  test('should parse valid CSV and bulk update draft attendance figures', async () => {
    // CSV with Peter absent 3 days and 1 half day, and Robbie absent 0
    const csvContent = `staffId,daysAbsent,halfDays\n${staffId1},3,1\n${staffId2},0,0`;
    
    const res = await request(app)
      .post(`/api/payroll/${runId}/attendance/upload`)
      .set('Authorization', `Bearer ${financeToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'attendance.csv');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.updated).toContain(staffId1);
    expect(res.body.data.summary.updated).toContain(staffId2);
    expect(res.body.data.summary.notFound).toHaveLength(0);
    expect(res.body.data.summary.errors).toHaveLength(0);

    // Verify employee calculations in the database run
    const updatedRun = res.body.data.run;
    const emp1Record = updatedRun.employees.find(e => e.employeeId.toString() === employeeId1.toString());
    expect(emp1Record.daysAbsent).toBe(3);
    expect(emp1Record.halfDays).toBe(1);
    // 22 working days in June 2026. daysWorked = 22 - 3 - 0.5 = 18.5
    expect(emp1Record.daysWorked).toBe(18.5);
    // proratedGross = 300,000 * 18.5/22 = 252,272.73
    expect(emp1Record.proratedGross).toBeCloseTo(252272.73, 2);
  });

  test('should return stats for unmatched staffId and parsing errors in CSV upload', async () => {
    // STARK-999 is not found, and third row has missing staffId, fourth has invalid attendance number
    const csvContent = `staffId,daysAbsent,halfDays\nSTARK-999,2,0\n,5,1\n${staffId1},invalid,2`;

    const res = await request(app)
      .post(`/api/payroll/${runId}/attendance/upload`)
      .set('Authorization', `Bearer ${financeToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'attendance.csv');

    expect(res.status).toBe(200);
    expect(res.body.data.summary.notFound).toContain('STARK-999');
    expect(res.body.data.summary.errors).toHaveLength(2); // row 2 (missing staffId) and row 3 (invalid value)
  });

  test('should block CSV upload if payroll run is already approved or paid', async () => {
    // Approve run
    await request(app)
      .post(`/api/payroll/${runId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`);

    const csvContent = `staffId,daysAbsent,halfDays\n${staffId1},2,0`;
    const res = await request(app)
      .post(`/api/payroll/${runId}/attendance/upload`)
      .set('Authorization', `Bearer ${financeToken}`)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'attendance.csv');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('only be uploaded for draft');
  });
});
