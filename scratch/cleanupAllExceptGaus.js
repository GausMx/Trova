require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const User = require('../models/User');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');
const Disbursement = require('../models/Disbursement');
const ComplianceRecord = require('../models/ComplianceRecord');
const SalaryGrade = require('../models/SalaryGrade');
const seedCompliance = require('../config/seeder');

async function cleanupPlatform() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Atlas DB:', mongoose.connection.name);

  // 1. Drop old single-field staffId_1 index on Employee collection if it exists
  try {
    await Employee.collection.dropIndex('staffId_1');
    console.log('✔ Dropped legacy global staffId_1 index from MongoDB Atlas.');
  } catch (err) {
    console.log('Info: staffId_1 index not found or already dropped.');
  }

  // Ensure compound index is built
  await Employee.syncIndexes();
  console.log('✔ Synced Mongoose indexes (compound companyId_1_staffId_1 active).');

  // 2. Find or create lawalgaus1 company
  let gausUser = await User.findOne({ email: 'lawalgaus1@gmail.com' });
  let gausCompany = await Company.findOne({ name: 'Trova HR' });

  if (!gausCompany) {
    gausCompany = await Company.create({
      name: 'Trova HR',
      industry: 'Human Resources',
      subscriptionTier: 'enterprise',
      isTrial: false,
      subscriptionStatus: 'active',
      status: 'active'
    });
    console.log('✔ Created Trova HR company.');
  } else {
    gausCompany.subscriptionTier = 'enterprise';
    gausCompany.subscriptionStatus = 'active';
    gausCompany.isTrial = false;
    await gausCompany.save();
    console.log('✔ Updated Trova HR company status to active enterprise.');
  }

  if (!gausUser) {
    gausUser = await User.create({
      companyId: gausCompany._id,
      firstName: 'Lawal',
      lastName: 'Gaus',
      email: 'lawalgaus1@gmail.com',
      password: 'Password123!',
      role: 'owner',
      isActive: true
    });
    console.log('✔ Created user lawalgaus1@gmail.com.');
  } else {
    gausUser.password = 'Password123!';
    gausUser.companyId = gausCompany._id;
    gausUser.role = 'owner';
    gausUser.isActive = true;
    await gausUser.save();
    console.log('✔ Reset password for lawalgaus1@gmail.com to Password123!.');
  }

  // 3. Delete all other users, companies, and associated data
  const userDel = await User.deleteMany({ email: { $ne: 'lawalgaus1@gmail.com' } });
  console.log(`✔ Deleted ${userDel.deletedCount} other user accounts.`);

  const compDel = await Company.deleteMany({ _id: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${compDel.deletedCount} other company records.`);

  const empDel = await Employee.deleteMany({ companyId: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${empDel.deletedCount} non-Gaus employee records.`);

  const payDel = await PayrollRun.deleteMany({ companyId: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${payDel.deletedCount} non-Gaus payroll runs.`);

  const disDel = await Disbursement.deleteMany({ companyId: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${disDel.deletedCount} non-Gaus disbursements.`);

  const compRecDel = await ComplianceRecord.deleteMany({ companyId: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${compRecDel.deletedCount} non-Gaus compliance records.`);

  const gradeDel = await SalaryGrade.deleteMany({ companyId: { $ne: gausCompany._id } });
  console.log(`✔ Deleted ${gradeDel.deletedCount} non-Gaus salary grades.`);

  // 4. Ensure statutory calendar items exist
  await seedCompliance();

  console.log('\n========================================');
  console.log('✅ PLATFORM CLEANUP COMPLETE!');
  console.log('Single Active User: lawalgaus1@gmail.com');
  console.log('Password: Password123!');
  console.log('Company: Trova HR');
  console.log('Multi-tenancy Staff ID scoping: ACTIVE ({ companyId: 1, staffId: 1 })');
  console.log('========================================');

  await mongoose.connection.close();
}

cleanupPlatform().catch(console.error);
