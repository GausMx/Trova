const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const SalaryGrade = require('../models/SalaryGrade');

describe('Subscription Gating Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-gating-test';
  let ownerToken;
  let companyId;
  let ownerUser;

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
    await SalaryGrade.deleteMany({});

    // Register a tenant company (starts on Trial / Growth tier)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Stark Industries',
        industry: 'Defense',
        firstName: 'Tony',
        lastName: 'Stark',
        email: 'tony@stark.com',
        password: 'pepperPassword123'
      });

    ownerToken = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;
    ownerUser = registerRes.body.data.user;
  });

  describe('Feature Access Gating', () => {
    test('should allow salary grades access for active trial (effective Growth tier)', async () => {
      // By default, registration sets status to 'trial'
      const res = await request(app)
        .get('/api/grades')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should deny salary grades access for Starter tier with correct payload parameters', async () => {
      // Manually update company to starter
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
        isTrial: false
      });

      const res = await request(app)
        .get('/api/grades')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.requiredTier).toBe('growth');
      expect(res.body.currentTier).toBe('starter');
      expect(res.body.upgradeUrl).toBe('/billing');
    });

    test('should allow custom PAYE config / AI Copilot only for Enterprise tier', async () => {
      // By default, company starts on Trial (effective Growth tier) which should now be denied access to AI Copilot
      const checkGrowth = await request(app)
        .get('/api/copilot')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      expect(checkGrowth.body.success).toBe(false);
      expect(checkGrowth.body.requiredTier).toBe('enterprise');

      // Starter tier should also be denied
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
        isTrial: false
      });

      const checkStarter = await request(app)
        .get('/api/copilot')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      expect(checkStarter.body.success).toBe(false);
      expect(checkStarter.body.requiredTier).toBe('enterprise');

      // Enterprise tier should be allowed
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'enterprise',
        isTrial: false
      });

      const checkEnterprise = await request(app)
        .get('/api/copilot')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(checkEnterprise.body.success).toBe(true);
    });

    test('should allow PDF payslip generation for Starter tier', async () => {
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
        isTrial: false
      });

      const mockMongoId1 = new mongoose.Types.ObjectId();
      const mockMongoId2 = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/payroll/${mockMongoId1}/payslip/${mockMongoId2}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).not.toBe(403);
    });
  });

  describe('Silent Trial Expiry Auto-Downgrade', () => {
    test('should auto-downgrade expired trial to unpaid status (lockout) on request', async () => {
      // Set trial EndsAt to 1 hour ago
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'trial',
        isTrial: true,
        trialEndsAt: new Date(Date.now() - 60 * 60 * 1000)
      });

      // Hit an authenticated route (e.g. /api/auth/me or any protected route)
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // Verify database updated company to unpaid
      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.subscriptionStatus).toBe('unpaid');
      expect(updatedCompany.isTrial).toBe(false);
    });
  });

  describe('Subscription Lockout Gating', () => {
    test('should block access to employees API when company is unpaid', async () => {
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'unpaid',
        isTrial: false
      });

      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(res.body.upgradeUrl).toBe('/billing');
    });

    test('should verify transaction and activate subscription plan', async () => {
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'unpaid',
        isTrial: false
      });

      // We use REF_mock_ reference which resolves mock metadata: { companyId: 'mock_company_id_123', tier: 'starter' }
      const res = await request(app)
        .get('/api/billing/verify/REF_mock_starter')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionTier).toBe('starter');
      expect(res.body.data.subscriptionStatus).toBe('active');
      expect(res.body.data.isTrial).toBe(false);

      // Verify DB updated
      const company = await Company.findById(companyId);
      expect(company.subscriptionTier).toBe('starter');
      expect(company.subscriptionStatus).toBe('active');
    });
  });

  describe('Employee Count Limits Enforcement', () => {
    test('should prevent creating employee exceeding Starter tier limit (20)', async () => {
      // Downgrade to starter
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
        isTrial: false
      });

      // Create 20 active employees manually in DB
      const employees = [];
      for (let i = 0; i < 20; i++) {
        employees.push({
          companyId,
          staffId: `ST-${1000 + i}`,
          firstName: `Emp-${i}`,
          lastName: 'Test',
          email: `emp${i}@stark.com`,
          status: 'active',
          basicSalary: 50000,
          housingAllowance: 10000,
          transportAllowance: 10000,
          otherAllowances: 0,
          bankName: '058',
          accountNumber: '0112233445',
          accountName: 'Emp Test'
        });
      }
      await Employee.insertMany(employees);

      // Attempt to register 21st employee via API
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Peter',
          lastName: 'Parker',
          email: 'peter@parker.com',
          basicSalary: 45000,
          housingAllowance: 5000,
          transportAllowance: 5000,
          otherAllowances: 0,
          bankName: '058',
          accountNumber: '0998877665',
          accountName: 'Peter Parker'
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('limit of 20 employees');
      expect(res.body.currentCount).toBe(20);
      expect(res.body.limit).toBe(20);
    });

    test('should prevent computing payroll when active employee count exceeds Starter tier limit (20)', async () => {
      // Downgrade to starter
      await Company.findByIdAndUpdate(companyId, {
        subscriptionStatus: 'active',
        subscriptionTier: 'starter',
        isTrial: false
      });

      // Create 21 active employees manually in DB (bypassing create limit)
      const employees = [];
      for (let i = 0; i < 21; i++) {
        employees.push({
          companyId,
          staffId: `ST-${1000 + i}`,
          firstName: `Emp-${i}`,
          lastName: 'Test',
          email: `emp${i}@stark.com`,
          status: 'active',
          basicSalary: 50000,
          housingAllowance: 10000,
          transportAllowance: 10000,
          otherAllowances: 0,
          bankName: '058',
          accountNumber: '0112233445',
          accountName: 'Emp Test'
        });
      }
      await Employee.insertMany(employees);

      // Attempt to calculate payroll
      const res = await request(app)
        .post('/api/payroll/compute')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          month: 6,
          year: 2026
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('limit of 20 employees');
      expect(res.body.currentCount).toBe(21);
      expect(res.body.limit).toBe(20);
    });
  });
});
