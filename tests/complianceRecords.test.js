const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const PayrollRun = require('../models/PayrollRun');
const StatutoryCalendar = require('../models/StatutoryCalendar');
const ComplianceRecord = require('../models/ComplianceRecord');
const Employee = require('../models/Employee');
const seedCompliance = require('../config/seeder');

describe('Compliance Records & Manual Confirmation API Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-compliance-records-test';
  
  let ownerToken;
  let financeToken;
  let hrToken;
  let companyId;
  let ownerId;
  
  let companyId2;
  let ownerToken2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testMongoUri);
    }
    // Populate the database with statutory calendar deadlines
    await seedCompliance();
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
    await PayrollRun.deleteMany({});
    await ComplianceRecord.deleteMany({});
    await Employee.deleteMany({});

    // 1. Register Company 1 and Owner
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Lekki Tech Hub',
        industry: 'Software',
        firstName: 'Tunde',
        lastName: 'Fashola',
        email: 'tunde@lekki.tech',
        password: 'tundePassword123'
      });

    ownerToken = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;
    ownerId = registerRes.body.data.user._id;

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

    // 3. Create HR User
    await User.create({
      companyId,
      firstName: 'Ned',
      lastName: 'Leeds',
      email: 'ned@bugle.test',
      password: 'nedPassword123',
      role: 'hr'
    });

    const hrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ned@bugle.test', password: 'nedPassword123' });
    hrToken = hrLogin.body.data.token;

    // 4. Register Company 2 (for tenant isolation testing)
    const registerRes2 = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Yaba Tech Hub',
        industry: 'Hardware',
        firstName: 'Segun',
        lastName: 'Adebayo',
        email: 'segun@yaba.tech',
        password: 'segunPassword123'
      });

    ownerToken2 = registerRes2.body.data.token;
    companyId2 = registerRes2.body.data.company._id;
  });

  describe('Payroll run compute auto-creates compliance records', () => {
    test('should auto-create pending compliance records for PAYE, Pension, NSITF on compute payroll', async () => {
      // Create an employee for company 1
      await Employee.create({
        companyId,
        firstName: 'Peter',
        lastName: 'Parker',
        email: 'peter@bugle.test',
        basicSalary: 200000,
        housingAllowance: 50000,
        transportAllowance: 30000,
        otherAllowances: 20000
      });

      // Compute payroll for May 2026 (month = 5, year = 2026)
      const computeRes = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          month: 5,
          year: 2026
        })
        .expect(201);

      expect(computeRes.body.success).toBe(true);

      // Verify that compliance records are created for the next month (June 2026, month = 6, year = 2026)
      const records = await ComplianceRecord.find({
        companyId,
        month: 6,
        year: 2026
      });

      // We expect 3 records (PAYE, Pension, NSITF)
      expect(records.length).toBe(3);
      
      const statuses = records.map(r => r.status);
      expect(statuses.every(s => s === 'pending')).toBe(true);

      const obligationIds = records.map(r => r.obligationId);
      const calendarItems = await StatutoryCalendar.find({ _id: { $in: obligationIds } });
      const types = calendarItems.map(c => c.remittanceType);
      expect(types).toContain('PAYE');
      expect(types).toContain('Pension');
      expect(types).toContain('NSITF');
    });
  });

  describe('GET /api/compliance/records', () => {
    let testRecord;

    beforeEach(async () => {
      // Find a statutory calendar item (e.g. PAYE due June 2026)
      const calendarItem = await StatutoryCalendar.findOne({ remittanceType: 'PAYE', dueDate: { $gte: new Date(2026, 5, 1), $lte: new Date(2026, 5, 30) } });
      expect(calendarItem).toBeDefined();

      // Create a compliance record manually
      testRecord = await ComplianceRecord.create({
        companyId,
        obligationId: calendarItem._id,
        month: 6,
        year: 2026,
        status: 'pending'
      });
    });

    test('should retrieve all compliance records for the company', async () => {
      const res = await request(app)
        .get('/api/compliance/records')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.records.length).toBe(1);
      expect(res.body.data.records[0]._id.toString()).toBe(testRecord._id.toString());
      expect(res.body.data.records[0]).toHaveProperty('obligationId');
      expect(res.body.data.records[0].obligationId.remittanceType).toBe('PAYE');
    });

    test('should filter records by month, year, and status', async () => {
      // Query match (status is auto-synced to overdue because due date has passed)
      let res = await request(app)
        .get('/api/compliance/records?month=6&year=2026&status=overdue')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.records.length).toBe(1);

      // Query mismatch (different status)
      res = await request(app)
        .get('/api/compliance/records?month=6&year=2026&status=completed')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.records.length).toBe(0);

      // Query mismatch (different month)
      res = await request(app)
        .get('/api/compliance/records?month=5&year=2026')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.records.length).toBe(0);
    });

    test('should prevent tenant from accessing another tenant\'s records', async () => {
      const res = await request(app)
        .get('/api/compliance/records')
        .set('Authorization', `Bearer ${ownerToken2}`)
        .expect(200);

      // Should return 0 records because Company 2 has no records
      expect(res.body.data.records.length).toBe(0);
    });
  });

  describe('PATCH /api/compliance/records/:id/complete', () => {
    let testRecord;

    beforeEach(async () => {
      const calendarItem = await StatutoryCalendar.findOne({ remittanceType: 'Pension' });
      testRecord = await ComplianceRecord.create({
        companyId,
        obligationId: calendarItem._id,
        month: 6,
        year: 2026,
        status: 'pending'
      });
    });

    test('should complete a compliance record when requested by owner', async () => {
      const res = await request(app)
        .patch(`/api/compliance/records/${testRecord._id}/complete`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Paid online via Remita' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.record.status).toBe('completed');
      expect(res.body.data.record.completedBy._id.toString()).toBe(ownerId.toString());
      expect(res.body.data.record.completedAt).toBeDefined();
      expect(res.body.data.record.notes).toBe('Paid online via Remita');
    });

    test('should complete a compliance record when requested by finance', async () => {
      const res = await request(app)
        .patch(`/api/compliance/records/${testRecord._id}/complete`)
        .set('Authorization', `Bearer ${financeToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.record.status).toBe('completed');
    });

    test('should deny access to HR role', async () => {
      await request(app)
        .patch(`/api/compliance/records/${testRecord._id}/complete`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(403);
    });

    test('should enforce tenant isolation (company 2 cannot complete company 1 record)', async () => {
      await request(app)
        .patch(`/api/compliance/records/${testRecord._id}/complete`)
        .set('Authorization', `Bearer ${ownerToken2}`)
        .expect(403);
    });
  });
});
