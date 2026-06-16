const StatutoryCalendar = require('../models/StatutoryCalendar');
const ComplianceRecord = require('../models/ComplianceRecord');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Helper to calculate status from due date.
 */
const calculateStatusFromDueDate = (dueDate, today = new Date()) => {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - current.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'overdue';
  } else if (diffDays <= 3) {
    return 'due_soon';
  } else {
    return 'pending';
  }
};

/**
 * Helper to get days remaining.
 */
const getDaysRemaining = (dueDate, today = new Date()) => {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - current.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Helper to get day suffix (e.g. 7 -> 7th, 1 -> 1st)
 */
const getDayWithSuffix = (date) => {
  const day = new Date(date).getDate();
  if (day > 3 && day < 21) return day + 'th';
  switch (day % 10) {
    case 1:  return day + 'st';
    case 2:  return day + 'nd';
    case 3:  return day + 'rd';
    default: return day + 'th';
  }
};

/**
 * Helper to find or create a ComplianceRecord and sync its status if not completed.
 */
const findOrCreateComplianceRecord = async (companyId, calendarItem, today = new Date()) => {
  const dueDate = new Date(calendarItem.dueDate);
  const month = dueDate.getMonth() + 1;
  const year = dueDate.getFullYear();

  let record = await ComplianceRecord.findOne({
    companyId,
    obligationId: calendarItem._id,
    month,
    year
  });

  if (!record) {
    const status = calculateStatusFromDueDate(calendarItem.dueDate, today);
    record = await ComplianceRecord.create({
      companyId,
      obligationId: calendarItem._id,
      month,
      year,
      status
    });
  } else if (record.status !== 'completed') {
    const currentStatus = calculateStatusFromDueDate(calendarItem.dueDate, today);
    if (record.status !== currentStatus) {
      record.status = currentStatus;
      await record.save();
    }
  }

  return record;
};

/**
 * Retrieves statutory deadlines falling within the next 30 days.
 */
exports.getUpcomingDeadlines = catchAsync(async (req, res) => {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);

  const calendarItems = await StatutoryCalendar.find({
    dueDate: { $gte: start, $lte: end }
  }).sort({ dueDate: 1 });

  const deadlines = calendarItems.map((item) => {
    return {
      ...item.toObject(),
      daysRemaining: getDaysRemaining(item.dueDate)
    };
  });

  return sendSuccess(res, 'Upcoming compliance deadlines for the next 30 days retrieved successfully', {
    deadlines
  });
});

/**
 * Retrieves compliance obligations due in the current calendar month and calculates
 * their completion status based on persistent ComplianceRecords.
 */
exports.getComplianceSummary = catchAsync(async (req, res) => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  const startOfMonth = new Date(currentYear, today.getMonth(), 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

  // Fetch all compliance obligations due in this calendar month
  const calendarItems = await StatutoryCalendar.find({
    dueDate: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({ dueDate: 1 });

  // Map each calendar obligation to its current compliance record status
  const obligations = [];
  for (const item of calendarItems) {
    const record = await findOrCreateComplianceRecord(req.companyId, item, today);
    if (record.completedBy) {
      await record.populate('completedBy', 'firstName lastName');
    }

    let displayStatus = record.status;
    let details = '';

    if (record.status === 'completed') {
      const completedByName = record.completedBy 
        ? `${record.completedBy.firstName} ${record.completedBy.lastName}`
        : 'System';
      const formattedDate = new Date(record.completedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      details = `Marked complete by ${completedByName} on ${formattedDate}`;
    } else {
      const daysRemaining = getDaysRemaining(item.dueDate, today);
      if (daysRemaining < 0) {
        details = `Overdue by ${Math.abs(daysRemaining)} days. Remit immediately.`;
      } else if (daysRemaining === 0) {
        details = 'Due today. Action required.';
      } else {
        details = `Due in ${daysRemaining} days.`;
      }
    }

    // Override display status for CAC if not completed
    if (item.remittanceType === 'CAC Annual Return' && record.status !== 'completed') {
      displayStatus = 'action-required';
    }

    obligations.push({
      id: item._id,
      complianceRecordId: record._id,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      authority: item.authority,
      remittanceType: item.remittanceType,
      status: displayStatus,
      details,
      dueDayLabel: getDayWithSuffix(item.dueDate),
      daysRemaining: getDaysRemaining(item.dueDate, today),
      completedBy: record.completedBy ? {
        _id: record.completedBy._id,
        fullName: `${record.completedBy.firstName} ${record.completedBy.lastName}`
      } : null,
      completedAt: record.completedAt
    });
  }

  return sendSuccess(res, 'Current month compliance summary retrieved successfully', {
    currentPeriod: { month: currentMonth, year: currentYear },
    obligations
  });
});

/**
 * GET /api/compliance/records
 * Returns all ComplianceRecords for the company scoped by companyId, filterable by month/year and status.
 */
exports.getComplianceRecords = catchAsync(async (req, res) => {
  // First, sync statuses of all incomplete records for this company
  const incompleteRecords = await ComplianceRecord.find({
    companyId: req.companyId,
    status: { $ne: 'completed' }
  }).populate('obligationId');

  for (const record of incompleteRecords) {
    if (record.obligationId) {
      const currentStatus = calculateStatusFromDueDate(record.obligationId.dueDate);
      if (record.status !== currentStatus) {
        record.status = currentStatus;
        await record.save();
      }
    }
  }

  // Construct query filter
  const filter = { companyId: req.companyId };
  if (req.query.month) filter.month = Number(req.query.month);
  if (req.query.year) filter.year = Number(req.query.year);
  if (req.query.status) filter.status = req.query.status;

  const records = await ComplianceRecord.find(filter)
    .populate('obligationId')
    .populate('completedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  return sendSuccess(res, 'Compliance records retrieved successfully', { records });
});

/**
 * PATCH /api/compliance/records/:id/complete
 * Updates status to completed and logs completedBy and completedAt.
 */
exports.completeComplianceRecord = catchAsync(async (req, res) => {
  const record = await ComplianceRecord.findById(req.params.id);

  if (!record) {
    return sendError(res, 'Compliance record not found', 404);
  }

  // Tenant scoping check
  if (record.companyId.toString() !== req.companyId.toString()) {
    return sendError(res, 'Access denied. You do not have permission to modify this record.', 403);
  }

  if (record.status === 'completed') {
    return sendError(res, 'This compliance obligation has already been completed.', 400);
  }

  // Update compliance record details
  record.status = 'completed';
  record.completedBy = req.user._id;
  record.completedAt = new Date();
  if (req.body.notes) {
    record.notes = req.body.notes;
  }

  await record.save();
  await record.populate('completedBy', 'firstName lastName');

  return sendSuccess(res, 'Compliance obligation marked as completed successfully', { record });
});
