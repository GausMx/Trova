require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const Employee = require('../models/Employee');
const Company = require('../models/Company');

async function cleanAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Atlas DB:', mongoose.connection.name);

  const res = await Employee.deleteMany({});
  console.log(`Cleared ${res.deletedCount} employee records from Atlas.`);

  // Keep only lawalgaus1 company "Trova HR"
  await Company.deleteMany({ name: { $ne: 'Trova HR' } });

  await mongoose.connection.close();
}

cleanAll().catch(console.error);
