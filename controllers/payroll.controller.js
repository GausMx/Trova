const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const { calculateMonthlyPayroll } = require('../utils/payrollEngine');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { PAYROLL_STATUS } = require('../config/constants');
const { generatePayslipPdf } = require('../utils/payslipGenerator');

/**
 * Helper to round values to 2 decimal places.
 */
const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

/**
 * Computes and creates/updates a draft payroll run for a given month and year.
 * Executes PITA calculation algorithms on all active employees.
 */
exports.computePayroll = catchAsync(async (req, res) => {
  const { month, year } = req.body;

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
  });

  if (activeEmployees.length === 0) {
    return sendError(res, 'No active employees found to compute payroll for.', 400);
  }

  // 3. Perform calculations for each employee
  const calculatedEmployees = [];
  const totals = { gross: 0, tax: 0, pension: 0, nhf: 0, net: 0 };

  for (const emp of activeEmployees) {
    const payroll = calculateMonthlyPayroll({
      basicSalary: emp.basicSalary,
      housingAllowance: emp.housingAllowance,
      transportAllowance: emp.transportAllowance,
      otherAllowances: emp.otherAllowances
    });

    calculatedEmployees.push({
      employeeId: emp._id,
      staffId: emp.staffId,
      name: emp.fullName,
      basicSalary: emp.basicSalary,
      housingAllowance: emp.housingAllowance,
      transportAllowance: emp.transportAllowance,
      otherAllowances: emp.otherAllowances,
      grossSalary: payroll.monthlyGross,
      taxDeduction: payroll.monthlyTax,
      pensionDeduction: payroll.monthlyPension,
      nhfDeduction: payroll.monthlyNhf,
      netSalary: payroll.monthlyNet
    });

    // Accumulate totals
    totals.gross += payroll.monthlyGross;
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

  // 4. Update existing draft run or create a new one
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

  return sendSuccess(res, `Payroll run calculated successfully as draft for ${month}/${year}`, { run }, 201);
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
  });

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  return sendSuccess(res, 'Payroll run details retrieved successfully', { run });
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

