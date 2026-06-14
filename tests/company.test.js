const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Company = require('../models/Company');

describe('Company API Integration Tests', () => {
  const testMongoUri = 'mongodb://127.0.0.1:27017/trova-company-test';
  let ownerToken;
  let hrToken;
  let companyId;

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

    // 1. Register a tenant company (Bruce Wayne - Owner)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        companyName: 'Wayne Tech',
        industry: 'Advanced Tech',
        firstName: 'Bruce',
        lastName: 'Wayne',
        email: 'bruce@wayne.tech',
        password: 'waynePassword123'
      });

    ownerToken = registerRes.body.data.token;
    companyId = registerRes.body.data.company._id;

    // 2. Create an HR User under the same company
    const hrUser = await User.create({
      companyId,
      firstName: 'Lucius',
      lastName: 'Fox',
      email: 'lucius@wayne.tech',
      password: 'luciusPassword123',
      role: 'hr'
    });

    // Login as HR to get token
    const hrLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'lucius@wayne.tech',
        password: 'luciusPassword123'
      });
    
    hrToken = hrLoginRes.body.data.token;
  });

  describe('GET /api/companies/me', () => {
    test('should retrieve company details for owner', async () => {
      const res = await request(app)
        .get('/api/companies/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.company.name).toBe('Wayne Tech');
      expect(res.body.data.company.industry).toBe('Advanced Tech');
    });

    test('should retrieve company details for HR user', async () => {
      const res = await request(app)
        .get('/api/companies/me')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.company.name).toBe('Wayne Tech');
    });
  });

  describe('PUT /api/companies/me', () => {
    test('should allow owner to update company details', async () => {
      const res = await request(app)
        .put('/api/companies/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Wayne Enterprises International',
          industry: 'Global conglomerate',
          address: 'Wayne Tower, Gotham City'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.company.name).toBe('Wayne Enterprises International');
      expect(res.body.data.company.industry).toBe('Global conglomerate');
      expect(res.body.data.company.address).toBe('Wayne Tower, Gotham City');
    });

    test('should deny HR user from updating company details', async () => {
      const res = await request(app)
        .put('/api/companies/me')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          name: 'Lucius Corp'
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('You do not have permission');
    });

    test('should reject update if company name is empty', async () => {
      const res = await request(app)
        .put('/api/companies/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: ''
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });
  });
});
