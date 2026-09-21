require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const Employee = require('../models/Employee');
const Company = require('../models/Company');

async function checkEmps() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to Atlas DB:', mongoose.connection.name);
  
  const employees = await Employee.find({});
  console.log('Total Employee count:', employees.length);
  employees.forEach(e => console.log(`StaffId: ${e.staffId}, Name: ${e.fullName}, CompanyId: ${e.companyId}`));
  
  await mongoose.connection.close();
}

checkEmps().catch(console.error);
