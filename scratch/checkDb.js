require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const User = require('../models/User');
const Company = require('../models/Company');

async function checkDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Atlas DB:', mongoose.connection.name);
  const users = await User.find({}).populate('companyId');
  console.log('User count:', users.length);
  users.forEach(u => console.log(`User: ${u.email}, Role: ${u.role}, Company: ${u.companyId?.name}`));
  
  const companies = await Company.find({});
  console.log('Company count:', companies.length);
  companies.forEach(c => console.log(`Company: ${c.name}, Status: ${c.status}`));
  
  await mongoose.connection.close();
}

checkDatabase().catch(console.error);
