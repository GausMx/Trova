const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const PayrollRun = require('../models/PayrollRun');
const StatutoryCalendar = require('../models/StatutoryCalendar');
const seedCompliance = require('../config/seeder');

describe('Compliance Calendar & Obligations API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-compliance-test';
  
  let token;
  let companyId;
  let userId;

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

    // Register a tenant company and user
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

    token = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;
    userId = registerRes.body.data.user._id;
  });

  describe('GET /api/compliance/calendar', () => {
    test('should retrieve upcoming compliance deadlines for the next 30 days', async () => {
      const res = await request(app)
        .get('/api/compliance/calendar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('deadlines');
      expect(Array.isArray(res.body.data.deadlines)).toBe(true);
      
      // Since deadlines are seeded for 2026/2027 and current test time is June 2026 (local time 2026-06-12),
      // we expect at least PAYE, Pension, and NSITF deadlines for June/July to fall in the 30-day window.
      expect(res.body.data.deadlines.length).toBeGreaterThan(0);
      expect(res.body.data.deadlines[0]).toHaveProperty('title');
      expect(res.body.data.deadlines[0]).toHaveProperty('dueDate');
    });

    test('should reject request without authentication token', async () => {
      await request(app)
        .get('/api/compliance/calendar')
        .expect(401);
    });
  });

  describe('GET /api/compliance/summary', () => {
    let prevMonth;
    let prevYear;

    beforeEach(() => {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      prevMonth = currentMonth - 1;
      prevYear = currentYear;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
    });

    test('should return obligations summary with pending-payroll-run status if no payroll run exists', async () => {
      const res = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.obligations.length).toBeGreaterThan(0);
      
      // Verify monthly obligations show pending-payroll-run
      const payeObligation = res.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObligation).toBeDefined();
      expect(payeObligation.status).toBe('pending-payroll-run');
    });

    test('should reflect draft status if draft payroll run exists for previous month', async () => {
      // 1. Create a draft payroll run
      await PayrollRun.create({
        companyId,
        month: prevMonth,
        year: prevYear,
        status: 'draft',
        processedBy: userId,
        totals: { gross: 1000, tax: 100, pension: 80, nhf: 25, net: 795 },
        employees: []
      });

      // 2. Fetch compliance summary
      const res = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payeObligation = res.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObligation.status).toBe('draft-unapproved');
    });

    test('should reflect approved-pending-payment status if payroll run is approved', async () => {
      await PayrollRun.create({
        companyId,
        month: prevMonth,
        year: prevYear,
        status: 'approved',
        processedBy: userId,
        totals: { gross: 1000, tax: 100, pension: 80, nhf: 25, net: 795 },
        employees: []
      });

      const res = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payeObligation = res.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObligation.status).toBe('approved-pending-payment');
    });

    test('should reflect completed status if payroll run is marked paid', async () => {
      await PayrollRun.create({
        companyId,
        month: prevMonth,
        year: prevYear,
        status: 'paid',
        processedBy: userId,
        totals: { gross: 1000, tax: 100, pension: 80, nhf: 25, net: 795 },
        employees: []
      });

      const res = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payeObligation = res.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObligation.status).toBe('completed');
    });
  });
});
