const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const StatutoryCalendar = require('../models/StatutoryCalendar');
const ComplianceRecord = require('../models/ComplianceRecord');
const seedCompliance = require('../config/seeder');

describe('Compliance Calendar & Obligations API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-compliance-legacy-test';
  
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
    await ComplianceRecord.deleteMany({});

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
      
      expect(res.body.data.deadlines.length).toBeGreaterThan(0);
      expect(res.body.data.deadlines[0]).toHaveProperty('title');
      expect(res.body.data.deadlines[0]).toHaveProperty('dueDate');
      expect(res.body.data.deadlines[0]).toHaveProperty('daysRemaining');
    });

    test('should reject request without authentication token', async () => {
      await request(app)
        .get('/api/compliance/calendar')
        .expect(401);
    });
  });

  describe('GET /api/compliance/summary', () => {
    test('should return obligations summary with statuses determined by due dates', async () => {
      const res = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.obligations.length).toBeGreaterThan(0);
      
      // Verify that all returned obligations have the required fields
      const payeObligation = res.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObligation).toBeDefined();
      expect(payeObligation).toHaveProperty('complianceRecordId');
      expect(['pending', 'due-soon', 'overdue']).toContain(payeObligation.status);
    });

    test('should reflect completed status if manual compliance record is marked completed', async () => {
      // 1. Get the current obligations
      const summaryRes = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payeOb = summaryRes.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeOb).toBeDefined();
      expect(payeOb.complianceRecordId).toBeDefined();

      // 2. Mark the record as completed
      const completeRes = await request(app)
        .patch(`/api/compliance/records/${payeOb.complianceRecordId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(completeRes.body.success).toBe(true);

      // 3. Fetch summary again and verify it is completed
      const summaryRes2 = await request(app)
        .get('/api/compliance/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const payeObUpdated = summaryRes2.body.data.obligations.find(o => o.remittanceType === 'PAYE');
      expect(payeObUpdated.status).toBe('completed');
      expect(payeObUpdated.details).toContain('Marked complete by Tunde Fashola');
    });
  });
});
