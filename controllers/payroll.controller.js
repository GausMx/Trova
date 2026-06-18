const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const { calculateMonthlyPayroll, getWorkingDays } = require('../utils/payrollEngine');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { PAYROLL_STATUS, BANK_CODES } = require('../config/constants');
const { generatePayslipPdf } = require('../utils/payslipGenerator');
const Papa = require('papaparse');
const StatutoryCalendar = require('../models/StatutoryCalendar');
const ComplianceRecord = require('../models/ComplianceRecord');
const { getSubscriptionEmployeeLimit } = require('../utils/subscriptionLimits');

/**
 * Helper to round values to 2 decimal places.
 */
const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Computes and creates/updates a draft payroll run for a given month and year.
 * Executes PITA calculation algorithms on all active employees.
 */
exports.computePayroll = catchAsync(async (req, res) => {
  const { month, year, attendance = [] } = req.body;

  // Check active employee limits on paid tiers/trials
  const activeEmployeeCount = await Employee.countDocuments({
    companyId: req.companyId,
    status: 'active'
  });

  const limit = getSubscriptionEmployeeLimit(req.company);

  if (activeEmployeeCount > limit) {
    const tierName = req.company.subscriptionStatus === 'trial' ? 'trial' : `${req.company.subscriptionTier} plan`;
    return res.status(403).json({
      success: false,
      message: `Your active employee count (${activeEmployeeCount}) exceeds the ${tierName} limit of ${limit} employees. Upgrade your plan to process payroll.`,
      currentCount: activeEmployeeCount,
      limit,
      upgradeUrl: '/billing'
    });
  }

  // 1. Check if a payroll run for this period already exists and is locked
  const existingRun = await PayrollRun.findOne({
    companyId: req.companyId,
    month,
    year
  });

  if (existingRun && existingRun.status !== PAYROLL_STATUS.DRAFT) {
    return sendError(res, `Payroll run for ${month}/${year} is already approved or paid and cannot be recalculated.`, 400);
  }

  // 2. Fetch all active employees for this tenant
  const activeEmployees = await Employee.find({
    companyId: req.companyId,
    status: 'active'
  }).populate('gradeId');

  if (activeEmployees.length === 0) {
    return sendError(res, 'No active employees found to compute payroll for.', 400);
  }

  // 3. Auto-calculate working days in the month
  const workingDaysInMonth = getWorkingDays(month, year);

  // 4. Perform calculations for each employee
  const calculatedEmployees = [];
  const totals = { gross: 0, tax: 0, pension: 0, nhf: 0, net: 0 };

  for (const emp of activeEmployees) {
    // Look up attendance for this employee in request body
    const att = attendance.find(a => a.employeeId?.toString() === emp._id.toString()) || { daysAbsent: 0, halfDays: 0 };
    
    // Resolve salary components based on override logic
    let basicSalary = emp.basicSalary;
    let housingAllowance = emp.housingAllowance;
    let transportAllowance = emp.transportAllowance;
    let otherAllowances = emp.otherAllowances;

    if (!emp.salaryOverridden && emp.gradeId && emp.gradeId.isActive) {
      basicSalary = emp.gradeId.basicSalary;
      housingAllowance = emp.gradeId.housingAllowance;
      transportAllowance = emp.gradeId.transportAllowance;
      otherAllowances = emp.gradeId.otherAllowances;
    }

    const payroll = calculateMonthlyPayroll(
      { basicSalary, housingAllowance, transportAllowance, otherAllowances },
      { workingDaysInMonth, daysAbsent: att.daysAbsent || 0, halfDays: att.halfDays || 0 }
    );

    calculatedEmployees.push({
      employeeId: emp._id,
      staffId: emp.staffId,
      name: emp.fullName,
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      grossSalary: basicSalary + housingAllowance + transportAllowance + otherAllowances,
      workingDaysInMonth,
      daysAbsent: att.daysAbsent || 0,
      halfDays: att.halfDays || 0,
      daysWorked: payroll.daysWorked,
      proratedGross: payroll.proratedGross,
      taxDeduction: payroll.monthlyTax,
      pensionDeduction: payroll.monthlyPension,
      nhfDeduction: payroll.monthlyNhf,
      netSalary: payroll.monthlyNet
    });

    // Accumulate totals based on prorated gross
    totals.gross += payroll.proratedGross;
    totals.tax += payroll.monthlyTax;
    totals.pension += payroll.monthlyPension;
    totals.nhf += payroll.monthlyNhf;
    totals.net += payroll.monthlyNet;
  }

  // Round totals
  totals.gross = round(totals.gross);
  totals.tax = round(totals.tax);
  totals.pension = round(totals.pension);
  totals.nhf = round(totals.nhf);
  totals.net = round(totals.net);

  let run;

  // 5. Update existing draft run or create a new one
  if (existingRun) {
    existingRun.processedBy = req.user._id;
    existingRun.totals = totals;
    existingRun.employees = calculatedEmployees;
    run = await existingRun.save();
  } else {
    run = await PayrollRun.create({
      companyId: req.companyId,
      month,
      year,
      status: PAYROLL_STATUS.DRAFT,
      processedBy: req.user._id,
      totals,
      employees: calculatedEmployees
    });
  }

  // 6. Auto-create compliance records for the next month's obligations (PAYE, pension, NSITF)
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const startOfNextMonth = new Date(nextYear, nextMonth - 1, 1);
  const endOfNextMonth = new Date(nextYear, nextMonth, 0, 23, 59, 59);

  const calendarItems = await StatutoryCalendar.find({
    remittanceType: { $in: ['PAYE', 'Pension', 'NSITF'] },
    dueDate: { $gte: startOfNextMonth, $lte: endOfNextMonth }
  });

  for (const item of calendarItems) {
    const existingRecord = await ComplianceRecord.findOne({
      companyId: req.companyId,
      obligationId: item._id,
      month: nextMonth,
      year: nextYear
    });

    if (!existingRecord) {
      await ComplianceRecord.create({
        companyId: req.companyId,
        obligationId: item._id,
        month: nextMonth,
        year: nextYear,
        status: 'pending'
      });
    }
  }

  return sendSuccess(res, `Payroll run calculated successfully as draft for ${month}/${year}`, { run }, 201);
});

/**
 * Updates attendance figures for a DRAFT payroll run and recomputes calculations.
 */
exports.updateAttendance = catchAsync(async (req, res) => {
  const { attendance = [] } = req.body;

  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status !== PAYROLL_STATUS.DRAFT) {
    return sendError(res, 'Attendance can only be updated for draft payroll runs', 400);
  }

  const workingDaysInMonth = getWorkingDays(run.month, run.year);
  const employeeIds = run.employees.map(e => e.employeeId);

  // Fetch company employees to pull up-to-date salary/grade details
  const companyEmployees = await Employee.find({
    _id: { $in: employeeIds },
    companyId: req.companyId
  }).populate('gradeId');

  const totals = { gross: 0, tax: 0, pension: 0, nhf: 0, net: 0 };

  for (const empRecord of run.employees) {
    // Find matching employee details
    const emp = companyEmployees.find(e => e._id.toString() === empRecord.employeeId.toString());
    
    // Look up attendance update in payload, default to current values in the run if not provided
    const att = attendance.find(a => a.employeeId?.toString() === empRecord.employeeId.toString());
    const daysAbsent = att !== undefined ? (att.daysAbsent || 0) : empRecord.daysAbsent;
    const halfDays = att !== undefined ? (att.halfDays || 0) : empRecord.halfDays;

    let basicSalary = empRecord.basicSalary;
    let housingAllowance = empRecord.housingAllowance;
    let transportAllowance = empRecord.transportAllowance;
    let otherAllowances = empRecord.otherAllowances;

    if (emp) {
      basicSalary = emp.basicSalary;
      housingAllowance = emp.housingAllowance;
      transportAllowance = emp.transportAllowance;
      otherAllowances = emp.otherAllowances;

      if (!emp.salaryOverridden && emp.gradeId && emp.gradeId.isActive) {
        basicSalary = emp.gradeId.basicSalary;
        housingAllowance = emp.gradeId.housingAllowance;
        transportAllowance = emp.gradeId.transportAllowance;
        otherAllowances = emp.gradeId.otherAllowances;
      }
    }

    const payroll = calculateMonthlyPayroll(
      { basicSalary, housingAllowance, transportAllowance, otherAllowances },
      { workingDaysInMonth, daysAbsent, halfDays }
    );

    // Update employee record
    empRecord.basicSalary = basicSalary;
    empRecord.housingAllowance = housingAllowance;
    empRecord.transportAllowance = transportAllowance;
    empRecord.otherAllowances = otherAllowances;
    empRecord.grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;
    empRecord.workingDaysInMonth = workingDaysInMonth;
    empRecord.daysAbsent = daysAbsent;
    empRecord.halfDays = halfDays;
    empRecord.daysWorked = payroll.daysWorked;
    empRecord.proratedGross = payroll.proratedGross;
    empRecord.taxDeduction = payroll.monthlyTax;
    empRecord.pensionDeduction = payroll.monthlyPension;
    empRecord.nhfDeduction = payroll.monthlyNhf;
    empRecord.netSalary = payroll.monthlyNet;

    // Accumulate run totals
    totals.gross += payroll.proratedGross;
    totals.tax += payroll.monthlyTax;
    totals.pension += payroll.monthlyPension;
    totals.nhf += payroll.monthlyNhf;
    totals.net += payroll.monthlyNet;
  }

  // Update and round totals
  run.totals = {
    gross: round(totals.gross),
    tax: round(totals.tax),
    pension: round(totals.pension),
    nhf: round(totals.nhf),
    net: round(totals.net)
  };

  const updatedRun = await run.save();

  return sendSuccess(res, 'Payroll run attendance updated and recalculated successfully', { run: updatedRun });
});

/**
 * Returns a clean attendance summary for the run showing proration figures.
 */
exports.getAttendanceSheet = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const attendance = run.employees.map((emp) => {
    const prorationPercentage = emp.workingDaysInMonth > 0 
      ? round((emp.daysWorked / emp.workingDaysInMonth) * 100) 
      : 100;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      staffId: emp.staffId,
      workingDaysInMonth: emp.workingDaysInMonth,
      daysAbsent: emp.daysAbsent,
      halfDays: emp.halfDays,
      daysWorked: emp.daysWorked,
      prorationPercentage
    };
  });

  return sendSuccess(res, 'Attendance sheet retrieved successfully', {
    runId: run._id,
    month: run.month,
    year: run.year,
    attendance
  });
});

/**
 * Bulk updates attendance figures via CSV file upload for DRAFT runs.
 */
exports.uploadAttendanceCsv = catchAsync(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'No CSV file uploaded', 400);
  }

  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status !== PAYROLL_STATUS.DRAFT) {
    return sendError(res, 'Attendance can only be uploaded for draft payroll runs', 400);
  }

  const csvString = req.file.buffer.toString('utf8');
  const parseResult = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true
  });

  if (parseResult.errors.length > 0) {
    return sendError(res, 'Failed to parse CSV file', 400);
  }

  const csvRows = parseResult.data;
  const updated = [];
  const notFound = [];
  const errors = [];

  const companyEmployees = await Employee.find({ companyId: req.companyId }).populate('gradeId');

  // Parse CSV records into a lookup map by staffId
  const attendanceMap = new Map();
  for (const row of csvRows) {
    const staffId = row.staffId?.trim();
    const daysAbsent = parseFloat(row.daysAbsent);
    const halfDays = parseFloat(row.halfDays);

    if (!staffId) {
      errors.push({ row, error: 'Missing staffId field' });
      continue;
    }

    if (isNaN(daysAbsent) || daysAbsent < 0) {
      errors.push({ staffId, error: 'daysAbsent must be a positive number' });
      continue;
    }

    if (isNaN(halfDays) || halfDays < 0) {
      errors.push({ staffId, error: 'halfDays must be a positive number' });
      continue;
    }

    attendanceMap.set(staffId, { daysAbsent, halfDays });
  }

  const workingDaysInMonth = getWorkingDays(run.month, run.year);
  const totals = { gross: 0, tax: 0, pension: 0, nhf: 0, net: 0 };

  for (const empRecord of run.employees) {
    const emp = companyEmployees.find(e => e._id.toString() === empRecord.employeeId.toString());
    
    let daysAbsent = empRecord.daysAbsent;
    let halfDays = empRecord.halfDays;

    if (emp && attendanceMap.has(emp.staffId)) {
      const att = attendanceMap.get(emp.staffId);
      daysAbsent = att.daysAbsent;
      halfDays = att.halfDays;
      updated.push(emp.staffId);
    }

    // Resolve salary details
    let basicSalary = empRecord.basicSalary;
    let housingAllowance = empRecord.housingAllowance;
    let transportAllowance = empRecord.transportAllowance;
    let otherAllowances = empRecord.otherAllowances;

    if (emp) {
      basicSalary = emp.basicSalary;
      housingAllowance = emp.housingAllowance;
      transportAllowance = emp.transportAllowance;
      otherAllowances = emp.otherAllowances;

      if (!emp.salaryOverridden && emp.gradeId && emp.gradeId.isActive) {
        basicSalary = emp.gradeId.basicSalary;
        housingAllowance = emp.gradeId.housingAllowance;
        transportAllowance = emp.gradeId.transportAllowance;
        otherAllowances = emp.gradeId.otherAllowances;
      }
    }

    const payroll = calculateMonthlyPayroll(
      { basicSalary, housingAllowance, transportAllowance, otherAllowances },
      { workingDaysInMonth, daysAbsent, halfDays }
    );

    // Update record in run
    empRecord.basicSalary = basicSalary;
    empRecord.housingAllowance = housingAllowance;
    empRecord.transportAllowance = transportAllowance;
    empRecord.otherAllowances = otherAllowances;
    empRecord.grossSalary = basicSalary + housingAllowance + transportAllowance + otherAllowances;
    empRecord.workingDaysInMonth = workingDaysInMonth;
    empRecord.daysAbsent = daysAbsent;
    empRecord.halfDays = halfDays;
    empRecord.daysWorked = payroll.daysWorked;
    empRecord.proratedGross = payroll.proratedGross;
    empRecord.taxDeduction = payroll.monthlyTax;
    empRecord.pensionDeduction = payroll.monthlyPension;
    empRecord.nhfDeduction = payroll.monthlyNhf;
    empRecord.netSalary = payroll.monthlyNet;

    // Accumulate run totals
    totals.gross += payroll.proratedGross;
    totals.tax += payroll.monthlyTax;
    totals.pension += payroll.monthlyPension;
    totals.nhf += payroll.monthlyNhf;
    totals.net += payroll.monthlyNet;
  }

  // Find staffIds in CSV that do not match any employee in the run
  for (const staffId of attendanceMap.keys()) {
    if (!updated.includes(staffId)) {
      notFound.push(staffId);
    }
  }

  run.totals = {
    gross: round(totals.gross),
    tax: round(totals.tax),
    pension: round(totals.pension),
    nhf: round(totals.nhf),
    net: round(totals.net)
  };

  await run.save();

  return sendSuccess(res, 'Attendance CSV uploaded and processed successfully', {
    run,
    summary: {
      updated,
      notFound: [...new Set(notFound)],
      errors
    }
  });
});

/**
 * Approves a draft payroll run, locking it from recalculation.
 */
exports.approvePayroll = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status === PAYROLL_STATUS.APPROVED) {
    return sendError(res, 'Payroll run is already approved', 400);
  }

  if (run.status === PAYROLL_STATUS.PAID) {
    return sendError(res, 'Payroll run is already paid and completed', 400);
  }

  run.status = PAYROLL_STATUS.APPROVED;
  const approvedRun = await run.save();

  return sendSuccess(res, 'Payroll run approved successfully', { run: approvedRun });
});

/**
 * Finalizes an approved payroll run, marking it as paid.
 */
exports.payPayroll = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status === PAYROLL_STATUS.DRAFT) {
    return sendError(res, 'Payroll run must be approved before it can be processed as paid', 400);
  }

  if (run.status === PAYROLL_STATUS.PAID) {
    return sendError(res, 'Payroll run is already processed as paid', 400);
  }

  run.status = PAYROLL_STATUS.PAID;
  const paidRun = await run.save();

  return sendSuccess(res, 'Payroll run processed as paid successfully', { run: paidRun });
});

/**
 * Lists all payroll runs for the company.
 */
exports.getPayrollRuns = catchAsync(async (req, res) => {
  const runs = await PayrollRun.find({ companyId: req.companyId })
    .select('-employees') // Exclude heavy detail in list views
    .sort({ year: -1, month: -1 });

  return sendSuccess(res, 'Payroll runs retrieved successfully', { runs });
});

/**
 * Retrieves the details of a single payroll run, including employee calculations list.
 */
exports.getPayrollRunById = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const runObj = run.toObject();

  runObj.employees = runObj.employees.map((pe, idx) => {
    const originalPe = run.employees[idx];
    const emp = originalPe.employeeId;
    const empId = emp ? (emp._id ? emp._id.toString() : emp.toString()) : '';
    return {
      ...pe,
      employeeId: empId,
      bankName: emp ? emp.bankName : '',
      bankCode: emp ? emp.bankCode : '',
      accountNumber: emp ? emp.accountNumber : '',
      accountName: emp ? emp.accountName : '',
      employeeStatus: emp ? emp.status : 'inactive'
    };
  });

  return sendSuccess(res, 'Payroll run details retrieved successfully', { run: runObj });
});

/**
 * Generates and streams the PDF payslip for a specific employee in a payroll run.
 */
exports.getPayslip = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const employeeRecord = run.employees.find(
    (emp) => emp.employeeId.toString() === req.params.employeeId
  );

  if (!employeeRecord) {
    return sendError(res, 'Employee payroll record not found in this run', 404);
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodName = `${months[run.month - 1]} ${run.year}`;

  const pdfBuffer = await generatePayslipPdf(
    req.company.name,
    employeeRecord,
    periodName
  );

  const sanitizedStaffId = employeeRecord.staffId.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `payslip_${sanitizedStaffId}_${run.month}_${run.year}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Length', pdfBuffer.length);

  return res.end(pdfBuffer);
});

/**
 * Helper to get month name.
 */
const getMonthName = (monthNum) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNum - 1] || '';
};

/**
 * Helper to dynamically resolve bank code.
 */
const getBankCode = (bankName) => {
  if (!bankName) return '';
  if (BANK_CODES[bankName]) return BANK_CODES[bankName];
  const lowerName = bankName.toLowerCase().trim();
  const found = Object.entries(BANK_CODES).find(([name]) => name.toLowerCase() === lowerName);
  return found ? found[1] : '';
};

/**
 * Generates bulk payment file in CSV format.
 */
exports.getPaymentFileCsv = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status !== 'approved' && run.status !== 'paid') {
    return sendError(res, 'Payment files can only be generated for approved or paid payroll runs', 400);
  }

  // Filter out employees with missing bank details or inactive status
  const activeEmployees = run.employees.filter(pe => {
    const emp = pe.employeeId;
    return emp && emp.status === 'active' && emp.accountNumber && emp.bankName;
  });

  const monthName = getMonthName(run.month);
  
  // Format rows
  const rows = activeEmployees.map(pe => {
    const emp = pe.employeeId;
    const amount = pe.netSalary.toFixed(2);
    const narration = `${monthName} ${run.year} Salary - ${emp.firstName} ${emp.lastName}`;
    const bankCode = emp.bankCode || getBankCode(emp.bankName);
    return [
      emp.accountNumber,
      emp.accountName || `${emp.firstName} ${emp.lastName}`,
      emp.bankName,
      bankCode,
      amount,
      narration
    ];
  });

  // Headers
  const headers = ['account_number', 'account_name', 'bank_name', 'bank_code', 'amount', 'narration'];
  const csvData = [headers, ...rows];

  const { stringify } = require('csv-stringify/sync');
  const csvString = stringify(csvData);

  const filename = `trova-salary-${monthName.toLowerCase()}-${run.year}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csvString);
});

/**
 * Generates bulk payment file in Excel format.
 */
exports.getPaymentFileExcel = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.id,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status !== 'approved' && run.status !== 'paid') {
    return sendError(res, 'Payment files can only be generated for approved or paid payroll runs', 400);
  }

  // Filter out employees with missing bank details or inactive status
  const activeEmployees = run.employees.filter(pe => {
    const emp = pe.employeeId;
    return emp && emp.status === 'active' && emp.accountNumber && emp.bankName;
  });

  const monthName = getMonthName(run.month);

  const XLSX = require('xlsx');

  // Format rows
  const rows = activeEmployees.map(pe => {
    const emp = pe.employeeId;
    const amount = pe.netSalary.toFixed(2);
    const narration = `${monthName} ${run.year} Salary - ${emp.firstName} ${emp.lastName}`;
    const bankCode = emp.bankCode || getBankCode(emp.bankName);
    return {
      account_number: emp.accountNumber,
      account_name: emp.accountName || `${emp.firstName} ${emp.lastName}`,
      bank_name: emp.bankName,
      bank_code: bankCode,
      amount,
      narration
    };
  });

  const headers = ['account_number', 'account_name', 'bank_name', 'bank_code', 'amount', 'narration'];
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();

  const sheetName = `Salary Payment ${monthName} ${run.year}`.substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const filename = `trova-salary-${monthName.toLowerCase()}-${run.year}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
});
