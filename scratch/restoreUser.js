require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const User = require('../models/User');
const Company = require('../models/Company');
const seedCompliance = require('../config/seeder');

async function restoreUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Atlas DB:', mongoose.connection.name);

  // Check if lawalgaus1@gmail.com exists
  let user = await User.findOne({ email: 'lawalgaus1@gmail.com' });
  let company = await Company.findOne({ name: 'Trova HR' });

  if (!company) {
    company = await Company.create({
      name: 'Trova HR',
      industry: 'Human Resources',
      subscriptionTier: 'enterprise',
      isTrial: false,
      subscriptionStatus: 'active',
      status: 'active'
    });
    console.log('Created Company: Trova HR');
  } else {
    company.subscriptionTier = 'enterprise';
    company.subscriptionStatus = 'active';
    company.isTrial = false;
    await company.save();
  }

  if (!user) {
    user = await User.create({
      companyId: company._id,
      firstName: 'Lawal',
      lastName: 'Gaus',
      email: 'lawalgaus1@gmail.com',
      password: 'Password123!',
      role: 'owner',
      isActive: true
    });
    console.log('Created User: lawalgaus1@gmail.com with password Password123!');
  } else {
    user.password = 'Password123!';
    user.role = 'owner';
    user.companyId = company._id;
    await user.save();
    console.log('Updated User: lawalgaus1@gmail.com password reset to Password123!');
  }

  // Also seed statutory calendar deadlines on Atlas
  await seedCompliance();

  console.log('✅ User lawalgaus1@gmail.com restored successfully!');
  await mongoose.connection.close();
}

restoreUser().catch(console.error);
