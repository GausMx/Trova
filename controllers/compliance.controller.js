const StatutoryCalendar = require('../models/StatutoryCalendar');
const PayrollRun = require('../models/PayrollRun');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * Retrieves statutory deadlines falling within the next 30 days.
 */
exports.getUpcomingDeadlines = catchAsync(async (req, res) => {
  const start = new Date();
  
  // Set end date to exactly 30 days from now
  const end = new Date();
  end.setDate(end.getDate() + 30);

  const deadlines = await StatutoryCalendar.find({
    dueDate: { $gte: start, $lte: end }
  }).sort({ dueDate: 1 });

  return sendSuccess(res, 'Upcoming compliance deadlines for the next 30 days retrieved successfully', {
    deadlines
  });
});

/**
 * Retrieves compliance obligations due in the current calendar month and calculates
 * their completion status based on the tenant's payroll records for the previous month.
 */
exports.getComplianceSummary = catchAsync(async (req, res) => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  // Define start and end of the current calendar month
  const startOfMonth = new Date(currentYear, today.getMonth(), 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  // Fetch all compliance obligations due in this calendar month
  const calendarItems = await StatutoryCalendar.find({
    dueDate: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({ dueDate: 1 });

  // Calculate previous payroll month/year
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  // Fetch the previous month's payroll run for this company
  const payrollRun = await PayrollRun.findOne({
    companyId: req.companyId,
    month: prevMonth,
    year: prevYear
  });

  // Map each calendar obligation to its current completion status
  const obligations = calendarItems.map((item) => {
    let status = 'pending-external-filing';
    let details = 'External annual/special filing required directly with authority';

    // Monthly payroll-related remittances (PAYE, Pension, NSITF)
    if (['PAYE', 'Pension', 'NSITF'].includes(item.remittanceType)) {
      if (!payrollRun) {
        status = 'pending-payroll-run';
        details = `Requires creation and computation of the payroll run for ${prevMonth}/${prevYear}`;
      } else if (payrollRun.status === 'paid') {
        status = 'completed';
        details = `Payroll run for ${prevMonth}/${prevYear} is marked paid. Statutory remittances processed.`;
      } else if (payrollRun.status === 'approved') {
        status = 'approved-pending-payment';
        details = `Payroll run for ${prevMonth}/${prevYear} is approved but pending payment confirmation.`;
      } else {
        status = 'draft-unapproved';
        details = `Payroll run for ${prevMonth}/${prevYear} is in draft. Needs approval and payment.`;
      }
    }

    return {
      id: item._id,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      authority: item.authority,
      remittanceType: item.remittanceType,
      status,
      details
    };
  });

  return sendSuccess(res, 'Current month compliance summary retrieved successfully', {
    currentPeriod: { month: currentMonth, year: currentYear },
    payrollCheckedPeriod: { month: prevMonth, year: prevYear },
    obligations
  });
});
