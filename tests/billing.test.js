const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');
const paystackService = require('../utils/paystackService');
const { SUBSCRIPTION_TIERS, COMPANY_STATUS } = require('../config/constants');

// Mock paystackService.initializeTransaction to prevent actual network calls in tests
jest.mock('../utils/paystackService', () => {
  const originalModule = jest.requireActual('../utils/paystackService');
  return {
    ...originalModule,
    initializeTransaction: jest.fn()
  };
});

describe('Billing & Subscription API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-billing-test';
  
  let ownerToken;
  let adminToken;
  let hrToken;
  let companyId;
  const ownerEmail = 'owner@trovabilling.test';
  const adminEmail = 'admin@trovabilling.test';
  const hrEmail = 'hr@trovabilling.test';

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
    jest.clearAllMocks();
    await User.deleteMany({});
    await Company.deleteMany({});

    // 1. Create a Company (starts at default STARTER tier)
    const company = await Company.create({
      name: 'Trova Billing Corp',
      industry: 'FinTech',
      subscriptionTier: SUBSCRIPTION_TIERS.STARTER,
      isTrial: false,
      status: COMPANY_STATUS.ACTIVE
    });
    companyId = company._id;

    // 2. Create an Owner User
    await User.create({
      companyId,
      firstName: 'Tunde',
      lastName: 'Owner',
      email: ownerEmail,
      password: 'password123',
      role: 'owner'
    });

    // 3. Create an Admin User
    await User.create({
      companyId,
      firstName: 'Bisi',
      lastName: 'Admin',
      email: adminEmail,
      password: 'password123',
      role: 'admin'
    });

    // 4. Create an HR User
    await User.create({
      companyId,
      firstName: 'Segun',
      lastName: 'HR',
      email: hrEmail,
      password: 'password123',
      role: 'hr'
    });

    // Logins to get tokens
    const ownerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'password123' });
    ownerToken = ownerLoginRes.body.data.token;

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' });
    adminToken = adminLoginRes.body.data.token;

    const hrLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: hrEmail, password: 'password123' });
    hrToken = hrLoginRes.body.data.token;
  });

  describe('POST /api/billing/initialize', () => {
    test('should allow company owner to initialize subscription checkout for starter tier', async () => {
      const mockCheckoutResponse = {
        authorization_url: 'https://checkout.paystack.com/mock_auth_url_starter',
        reference: 'mock_ref_starter_123'
      };
      paystackService.initializeTransaction.mockResolvedValue(mockCheckoutResponse);

      const res = await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ tier: SUBSCRIPTION_TIERS.STARTER })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('authorization_url', mockCheckoutResponse.authorization_url);
      expect(res.body.data).toHaveProperty('reference', mockCheckoutResponse.reference);

      expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
        ownerEmail,
        25000,
        process.env.PAYSTACK_PLAN_STARTER || 'PLN_mock_starter',
        {
          companyId: companyId.toString(),
          tier: SUBSCRIPTION_TIERS.STARTER
        }
      );
    });

    test('should allow company owner to initialize subscription checkout for growth tier', async () => {
      const mockCheckoutResponse = {
        authorization_url: 'https://checkout.paystack.com/mock_auth_url',
        reference: 'mock_ref_growth_123'
      };
      paystackService.initializeTransaction.mockResolvedValue(mockCheckoutResponse);

      const res = await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ tier: SUBSCRIPTION_TIERS.GROWTH })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('authorization_url', mockCheckoutResponse.authorization_url);
      expect(res.body.data).toHaveProperty('reference', mockCheckoutResponse.reference);

      expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
        ownerEmail,
        55000,
        process.env.PAYSTACK_PLAN_GROWTH || 'PLN_mock_growth',
        {
          companyId: companyId.toString(),
          tier: SUBSCRIPTION_TIERS.GROWTH
        }
      );
    });

    test('should allow company owner to initialize subscription checkout for enterprise tier', async () => {
      const mockCheckoutResponse = {
        authorization_url: 'https://checkout.paystack.com/mock_auth_url_ent',
        reference: 'mock_ref_ent_123'
      };
      paystackService.initializeTransaction.mockResolvedValue(mockCheckoutResponse);

      const res = await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ tier: SUBSCRIPTION_TIERS.ENTERPRISE })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('authorization_url', mockCheckoutResponse.authorization_url);
      expect(res.body.data).toHaveProperty('reference', mockCheckoutResponse.reference);

      expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
        ownerEmail,
        100000,
        process.env.PAYSTACK_PLAN_ENTERPRISE || 'PLN_mock_enterprise',
        {
          companyId: companyId.toString(),
          tier: SUBSCRIPTION_TIERS.ENTERPRISE
        }
      );
    });

    test('should reject invalid subscription tier', async () => {
      const res = await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ tier: 'invalid_tier' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });

    test('should deny access to non-owner users (e.g. HR role)', async () => {
      const res = await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ tier: SUBSCRIPTION_TIERS.GROWTH })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('You do not have permission to perform this action');
    });

    test('should deny access to admin users (only owner can upgrade/checkout)', async () => {
      await request(app)
        .post('/api/billing/initialize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tier: SUBSCRIPTION_TIERS.GROWTH })
        .expect(403);
    });

    test('should reject unauthenticated request', async () => {
      await request(app)
        .post('/api/billing/initialize')
        .send({ tier: SUBSCRIPTION_TIERS.GROWTH })
        .expect(401);
    });
  });

  describe('GET /api/billing/status', () => {
    test('should allow owner to check subscription status', async () => {
      const res = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('subscriptionTier', SUBSCRIPTION_TIERS.STARTER);
      expect(res.body.data).toHaveProperty('status', COMPANY_STATUS.ACTIVE);
    });

    test('should allow admin to check subscription status', async () => {
      const res = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionTier).toBe(SUBSCRIPTION_TIERS.STARTER);
    });

    test('should deny HR user from checking subscription status', async () => {
      await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(403);
    });

    test('should reject unauthenticated status request', async () => {
      await request(app)
        .get('/api/billing/status')
        .expect(401);
    });
  });

  describe('POST /api/billing/webhook', () => {
    test('should process charge.success and upgrade company subscription tier', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: 'paystack_ref_123',
          amount: 5500000,
          metadata: {
            companyId: companyId.toString(),
            tier: SUBSCRIPTION_TIERS.GROWTH
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || 'super_secret_paystack_webhook_12345!';
      const signature = crypto
        .createHmac('sha512', secret)
        .update(Buffer.from(payloadString))
        .digest('hex');

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-paystack-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.subscriptionTier).toBe(SUBSCRIPTION_TIERS.GROWTH);
      expect(updatedCompany.status).toBe(COMPANY_STATUS.ACTIVE);
    });

    test('should process subscription.disable and downgrade company subscription tier to free', async () => {
      const company = await Company.findById(companyId);
      company.subscriptionTier = SUBSCRIPTION_TIERS.GROWTH;
      await company.save();

      const payload = {
        event: 'subscription.disable',
        data: {
          status: 'disabled',
          metadata: {
            companyId: companyId.toString()
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || 'super_secret_paystack_webhook_12345!';
      const signature = crypto
        .createHmac('sha512', secret)
        .update(Buffer.from(payloadString))
        .digest('hex');

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-paystack-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.isTrial).toBe(true);
      expect(new Date(updatedCompany.trialEndsAt).getTime()).toBe(0);
    });

    test('should process subscription.disable and downgrade using email fallback if metadata is missing', async () => {
      const company = await Company.findById(companyId);
      company.subscriptionTier = SUBSCRIPTION_TIERS.GROWTH;
      await company.save();

      const payload = {
        event: 'subscription.disable',
        data: {
          status: 'disabled',
          customer: {
            email: ownerEmail
          }
        }
      };

      const payloadString = JSON.stringify(payload);
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || 'super_secret_paystack_webhook_12345!';
      const signature = crypto
        .createHmac('sha512', secret)
        .update(Buffer.from(payloadString))
        .digest('hex');

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-paystack-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.isTrial).toBe(true);
      expect(new Date(updatedCompany.trialEndsAt).getTime()).toBe(0);
    });

    test('should reject webhook payload with invalid signature', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          metadata: {
            companyId: companyId.toString(),
            tier: SUBSCRIPTION_TIERS.GROWTH
          }
        }
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('x-paystack-signature', 'invalid_signature_hex_12345')
        .send(payload)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid signature headers');

      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.subscriptionTier).toBe(SUBSCRIPTION_TIERS.STARTER);
    });

    test('should reject webhook payload with missing signature header', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          metadata: {
            companyId: companyId.toString(),
            tier: SUBSCRIPTION_TIERS.GROWTH
          }
        }
      };

      const res = await request(app)
        .post('/api/billing/webhook')
        .send(payload)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
