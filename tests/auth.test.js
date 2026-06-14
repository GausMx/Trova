const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');

describe('Authentication API Endpoint Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-auth-test';

  beforeAll(async () => {
    // Re-establish connection to dedicated test DB if mongoose disconnected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testMongoUri);
    }
  });

  afterAll(async () => {
    // Clean up databases and close connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clear collections to guarantee independent test runs
    await User.deleteMany({});
    await Company.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      companyName: 'Acme Nigeria Ltd',
      industry: 'Manufacturing',
      firstName: 'Chidi',
      lastName: 'Okonkwo',
      email: 'chidi@acme.ng',
      password: 'securePassword123'
    };

    test('should register a new tenant (company + user) and return token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successfully');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe('chidi@acme.ng');
      expect(res.body.data.user.role).toBe('owner');
      expect(res.body.data.company.name).toBe('Acme Nigeria Ltd');

      // Verify DB entries
      const companyCount = await Company.countDocuments({ name: 'Acme Nigeria Ltd' });
      const userCount = await User.countDocuments({ email: 'chidi@acme.ng' });
      expect(companyCount).toBe(1);
      expect(userCount).toBe(1);
    });

    test('should reject registration if email is invalid', async () => {
      const invalidData = { ...validRegistrationData, email: 'not-an-email' };

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some(e => e.path === 'email')).toBe(true);
    });

    test('should roll back company creation if user creation throws error', async () => {
      // Stub password field to fail User validation
      const invalidData = { ...validRegistrationData, password: '123' }; // password too short

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(res.body.success).toBe(false);

      // Verify that NO company was left behind due to rollback
      const companyCount = await Company.countDocuments({});
      const userCount = await User.countDocuments({});
      expect(companyCount).toBe(0);
      expect(userCount).toBe(0);
    });

    test('should fail if email is already taken', async () => {
      // Setup: register first user
      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      // Attempt second registration with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          companyName: 'Different Co'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    test('should register a non-owner user under an existing company without creating a duplicate company', async () => {
      // 1. Register first as owner to create the company
      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      // 2. Register a second user as admin under the same company
      const adminData = {
        companyName: validRegistrationData.companyName,
        industry: validRegistrationData.industry,
        firstName: 'Bisi',
        lastName: 'Admin',
        email: 'bisi@acme.ng',
        password: 'adminPassword123',
        role: 'admin'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.company.name).toBe(validRegistrationData.companyName);

      // Verify DB entries: 1 company, 2 users
      const companyCount = await Company.countDocuments({ name: validRegistrationData.companyName });
      const userCount = await User.countDocuments({ companyId: res.body.data.company._id });
      expect(companyCount).toBe(1);
      expect(userCount).toBe(2);
    });

    test('should reject non-owner registration if the company name does not exist', async () => {
      const hrData = {
        companyName: 'Non Existent Company Ltd',
        industry: 'Tech',
        firstName: 'Segun',
        lastName: 'HR',
        email: 'segun@nonexistent.ng',
        password: 'hrPassword123',
        role: 'hr'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(hrData)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Company not found');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Pre-register user for login testing
      await request(app)
        .post('/api/auth/register')
        .send({
          companyName: 'Stark Industries',
          industry: 'Defense',
          firstName: 'Tony',
          lastName: 'Stark',
          email: 'tony@stark.com',
          password: 'jarvisPassword123'
        });
    });

    test('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tony@stark.com',
          password: 'jarvisPassword123'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe('tony@stark.com');
      expect(res.body.data.user.fullName).toBe('Tony Stark');
    });

    test('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tony@stark.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      // Register and get token
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          companyName: 'Wayne Enterprises',
          industry: 'Security',
          firstName: 'Bruce',
          lastName: 'Wayne',
          email: 'bruce@wayne.co',
          password: 'batmanPassword123'
        });
      authToken = res.body.data.token;
    });

    test('should retrieve current user profile if authorized', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('bruce@wayne.co');
      expect(res.body.data.user.role).toBe('owner');
    });

    test('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    test('should reject invalid token signature', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          companyName: 'Wayne Enterprises',
          industry: 'Security',
          firstName: 'Bruce',
          lastName: 'Wayne',
          email: 'bruce@wayne.co',
          password: 'batmanPassword123'
        });
      refreshToken = res.body.data.refreshToken;
    });

    test('should return a new access token and refresh token when supplied with a valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    test('should reject if refresh token is missing', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Refresh token is required');
    });

    test('should reject if refresh token is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired refresh token');
    });
  });
});
