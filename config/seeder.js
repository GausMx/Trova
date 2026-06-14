require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const StatutoryCalendar = require('../models/StatutoryCalendar');

const seedCompliance = async () => {
  try {
    console.log('Connecting to database...');
    // Establish connection manually if not connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    console.log('Clearing existing statutory deadlines...');
    await StatutoryCalendar.deleteMany({});

    console.log('Generating Nigerian statutory deadlines for 2026 and 2027...');
    const deadlines = [];
    const years = [2026, 2027];

    for (const year of years) {
      // 1. Annual Deadlines
      // ITF (Industrial Training Fund) Annual Contribution -> due April 1st
      deadlines.push({
        title: `ITF Annual Contribution - ${year}`,
        description: `Annual Industrial Training Fund contribution due for the year ${year - 1}. Equal to 1% of the annual employer payroll for companies with 5+ employees or N50m+ turnover.`,
        dueDate: new Date(year, 3, 1), // April 1st (month index 3 is April)
        authority: 'ITF (Industrial Training Fund)',
        remittanceType: 'ITF'
      });

      // CAC (Corporate Affairs Commission) Annual Returns -> due June 30th
      deadlines.push({
        title: `CAC Annual Returns Filing - ${year}`,
        description: `Annual returns filing due for the corporate registration year ${year - 1}. Required to maintain active status with the Corporate Affairs Commission.`,
        dueDate: new Date(year, 5, 30), // June 30th (month index 5 is June)
        authority: 'CAC (Corporate Affairs Commission)',
        remittanceType: 'CAC Annual Return'
      });

      // 2. Monthly Deadlines
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const monthNum = monthIndex + 1;
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = months[monthIndex];

        // PAYE Remittance -> due 10th of following month
        // We set due date in this month, which represents the obligation for the PREVIOUS month's payroll.
        deadlines.push({
          title: `PAYE Tax Remittance - ${monthName} ${year}`,
          description: `Monthly PAYE tax deductions for the month of ${months[monthIndex === 0 ? 11 : monthIndex - 1]} ${monthIndex === 0 ? year - 1 : year} must be remitted to the State Board of Internal Revenue.`,
          dueDate: new Date(year, monthIndex, 10), // 10th of this month
          authority: 'LIRS / State Internal Revenue Service',
          remittanceType: 'PAYE'
        });

        // PENCOM Pension Remittance -> due 7th of following month
        deadlines.push({
          title: `Pension Contribution Remittance - ${monthName} ${year}`,
          description: `Monthly statutory pension deductions (8% employee, 10% employer) for the month of ${months[monthIndex === 0 ? 11 : monthIndex - 1]} ${monthIndex === 0 ? year - 1 : year} must be remitted to the Pension Fund Custodian.`,
          dueDate: new Date(year, monthIndex, 7), // 7th of this month
          authority: 'PENCOM (National Pension Commission)',
          remittanceType: 'Pension'
        });

        // NSITF Monthly Contribution -> due 16th of following month (or within 16 days of the next month)
        deadlines.push({
          title: `NSITF ECS Contribution - ${monthName} ${year}`,
          description: `Monthly Employees Compensation Scheme (ECS) contribution (1% of employee gross salary paid by employer) for the month of ${months[monthIndex === 0 ? 11 : monthIndex - 1]} ${monthIndex === 0 ? year - 1 : year} must be remitted to the NSITF.`,
          dueDate: new Date(year, monthIndex, 16), // 16th of this month
          authority: 'NSITF (National Social Insurance Trust Fund)',
          remittanceType: 'NSITF'
        });
      }
    }

    console.log(`Inserting ${deadlines.length} statutory calendar items...`);
    const inserted = await StatutoryCalendar.insertMany(deadlines);
    console.log(`✔ successfully seeded ${inserted.length} statutory calendar records.`);

    // Close connection only if we launched it inside this script
    if (require.main === module) {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    }
  } catch (error) {
    console.error('Error seeding statutory calendar database:', error);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

// Execute if run directly from console
if (require.main === module) {
  seedCompliance();
}

module.exports = seedCompliance;
