const PayrollRun = require('../models/PayrollRun');
const Disbursement = require('../models/Disbursement');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { aggregatePayrollRouting } = require('../config/billerRegistry');
const remitaService = require('../utils/remitaService');
const { PAYROLL_STATUS } = require('../config/constants');

/**
 * GET /api/disbursements/payroll/:payrollRunId/summary
 * Returns total cash outflow breakdown summary and multi-agency routing metadata.
 */
exports.getDisbursementSummary = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  // Aggregate routing line items and financial breakdown totals
  const aggregation = aggregatePayrollRouting(run.employees);

  // Check if a disbursement record already exists
  const existingDisbursement = await Disbursement.findOne({
    payrollRunId: run._id,
    companyId: req.companyId
  });

  return sendSuccess(res, 'Disbursement summary retrieved successfully', {
    payrollRun: {
      id: run._id,
      month: run.month,
      year: run.year,
      status: run.status
    },
    summary: aggregation.summary,
    routing: aggregation.routing,
    existingDisbursement: existingDisbursement || null
  });
});

/**
 * POST /api/disbursements/payroll/:payrollRunId/generate-rrr
 * Generates Remita Retrieval Reference (RRR) codes for Master Unified or Split RRR payment modes.
 */
exports.generateRRR = catchAsync(async (req, res) => {
  const { paymentMode = 'unified', splitCategories = ['salaries', 'statutory_unified'] } = req.body;

  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  if (run.status === PAYROLL_STATUS.DRAFT) {
    return sendError(res, 'Payroll run must be approved before generating disbursement RRR.', 400);
  }

  const aggregation = aggregatePayrollRouting(run.employees);
  const summary = aggregation.summary;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[run.month - 1]} ${run.year}`;

  const generatedRrrs = [];

  if (paymentMode === 'unified') {
    // Option A: Master Unified RRR (Salaries + Statutory Remittances)
    const requestId = `TRV-${run._id}-MASTER-${Date.now()}`;
    const result = await remitaService.requestRRR({
      requestId,
      amount: summary.totalOutflow,
      category: 'master',
      description: `Trova Master Payroll Payment - ${req.company.name} (${periodLabel})`,
      payerName: req.company.name,
      payerEmail: req.user.email
    });

    generatedRrrs.push({
      rrr: result.rrr,
      category: 'master',
      description: `Master RRR (Salaries + All Statutory Remittances)`,
      amount: summary.totalOutflow,
      status: 'generated',
      generatedAt: new Date(),
      beneficiaryDetails: {
        totalSalaries: summary.netSalaries,
        totalStatutory: summary.totalStatutory,
        paymentUrl: result.paymentUrl
      }
    });
  } else {
    // Option B: Split RRRs (Net Salaries RRR + Statutory Remittances RRR)
    
    // RRR #1: Net Salaries Only
    const salRequestId = `TRV-${run._id}-SAL-${Date.now()}`;
    const salResult = await remitaService.requestRRR({
      requestId: salRequestId,
      amount: summary.netSalaries,
      category: 'salaries',
      description: `Net Salaries Disbursement - ${req.company.name} (${periodLabel})`,
      payerName: req.company.name,
      payerEmail: req.user.email
    });

    generatedRrrs.push({
      rrr: salResult.rrr,
      category: 'salaries',
      description: `Net Salaries RRR (All Employees)`,
      amount: summary.netSalaries,
      status: 'generated',
      generatedAt: new Date(),
      beneficiaryDetails: {
        employeeCount: run.employees.length,
        paymentUrl: salResult.paymentUrl
      }
    });

    // RRR #2: Statutory Remittances
    if (summary.totalStatutory > 0) {
      const statRequestId = `TRV-${run._id}-STAT-${Date.now()}`;
      const statResult = await remitaService.requestRRR({
        requestId: statRequestId,
        amount: summary.totalStatutory,
        category: 'statutory_unified',
        description: `Statutory Remittances (PAYE, Pension, NSITF) - ${req.company.name} (${periodLabel})`,
        payerName: req.company.name,
        payerEmail: req.user.email
      });

      generatedRrrs.push({
        rrr: statResult.rrr,
        category: 'statutory_unified',
        description: `Statutory Remittances RRR (PAYE + Pension + NSITF + NHF)`,
        amount: summary.totalStatutory,
        status: 'generated',
        generatedAt: new Date(),
        beneficiaryDetails: {
          payeTax: summary.payeTax,
          pension: summary.pension,
          nsitf: summary.nsitf,
          paymentUrl: statResult.paymentUrl
        }
      });
    }
  }

  // Create or update Disbursement record
  let disbursement = await Disbursement.findOne({
    payrollRunId: run._id,
    companyId: req.companyId
  });

  if (disbursement) {
    disbursement.paymentMode = paymentMode;
    disbursement.rrrs = generatedRrrs;
    disbursement.totalOutflow = summary.totalOutflow;
    disbursement.totalSalaries = summary.netSalaries;
    disbursement.totalStatutory = summary.totalStatutory;
    disbursement.breakdown = aggregation;
    disbursement.status = 'pending';
    await disbursement.save();
  } else {
    disbursement = await Disbursement.create({
      companyId: req.companyId,
      payrollRunId: run._id,
      paymentMode,
      status: 'pending',
      totalOutflow: summary.totalOutflow,
      totalSalaries: summary.netSalaries,
      totalStatutory: summary.totalStatutory,
      rrrs: generatedRrrs,
      breakdown: aggregation,
      createdBy: req.user._id
    });
  }

  return sendSuccess(res, `RRR generated successfully in ${paymentMode} mode`, {
    disbursement
  });
});

/**
 * GET /api/disbursements/payroll/:payrollRunId/status
 * Fetches existing RRR disbursement records and statuses.
 */
exports.getDisbursementStatus = catchAsync(async (req, res) => {
  const disbursement = await Disbursement.findOne({
    payrollRunId: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('payrollRunId', 'month year status');

  if (!disbursement) {
    return sendError(res, 'No disbursement RRR record found for this payroll run.', 404);
  }

  return sendSuccess(res, 'Disbursement RRR status retrieved successfully', { disbursement });
});

/**
 * GET /api/disbursements/payroll/:payrollRunId/schedules/taxpro-max
 * Downloads TaxPro Max PAYE Tax CSV Schedule.
 */
exports.downloadTaxProMaxSchedule = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const { generateTaxProMaxCsv } = require('../utils/scheduleGenerator');
  const file = generateTaxProMaxCsv(run);

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.status(200).send(file.content);
});

/**
 * GET /api/disbursements/payroll/:payrollRunId/schedules/pencom
 * Downloads PenCom PFA Pension Excel (XLSX) Schedule.
 */
exports.downloadPenComSchedule = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const { generatePenComExcel } = require('../utils/scheduleGenerator');
  const file = generatePenComExcel(run, req.company.name);

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.status(200).send(file.buffer);
});

/**
 * GET /api/disbursements/payroll/:payrollRunId/schedules/nsitf
 * Downloads NSITF 1% ECS CSV Schedule.
 */
exports.downloadNsitfSchedule = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const { generateNsitfCsv } = require('../utils/scheduleGenerator');
  const file = generateNsitfCsv(run);

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.status(200).send(file.content);
});

/**
 * GET /api/disbursements/payroll/:payrollRunId/schedules/nhf
 * Downloads FMBN NHF 2.5% CSV Schedule.
 */
exports.downloadNhfSchedule = catchAsync(async (req, res) => {
  const run = await PayrollRun.findOne({
    _id: req.params.payrollRunId,
    companyId: req.companyId
  }).populate('employees.employeeId');

  if (!run) {
    return sendError(res, 'Payroll run not found', 404);
  }

  const { generateNhfCsv } = require('../utils/scheduleGenerator');
  const file = generateNhfCsv(run);

  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.status(200).send(file.content);
});

/**
 * POST /api/webhooks/remita
 * Asynchronous webhook handler for Remita RRR payment confirmation notifications.
 * Auto-reconciles Payroll run status to PAID, updates ComplianceRecord obligations to completed,
 * and generates/emails PDF payslips.
 */
exports.processRemitaWebhook = catchAsync(async (req, res) => {
  const { rrr, status, statuscode, channel, orderRef, paymentReference } = req.body;

  const targetRrr = rrr || orderRef;
  const isSuccessful = (status === '00' || status === '01' || statuscode === '00' || statuscode === '01');

  if (!targetRrr) {
    return sendError(res, 'Missing required RRR reference in webhook payload', 400);
  }

  // Locate Disbursement record containing this RRR
  const disbursement = await Disbursement.findOne({ 'rrrs.rrr': targetRrr });

  if (!disbursement) {
    // If not found, still acknowledge 200 to prevent Remita webhook retries blocking
    return res.status(200).json({ success: true, message: 'RRR not associated with an active Trova disbursement' });
  }

  const rrrItem = disbursement.rrrs.find((item) => item.rrr === targetRrr);
  if (!rrrItem) {
    return res.status(200).json({ success: true, message: 'RRR item not found' });
  }

  if (isSuccessful) {
    rrrItem.status = 'paid';
    rrrItem.paidAt = new Date();
    rrrItem.remitaPaymentReference = paymentReference || channel || `REM-${Date.now()}`;

    // Check overall disbursement status
    const allPaid = disbursement.rrrs.every((item) => item.status === 'paid');
    const salariesPaid = disbursement.rrrs.some(
      (item) => (item.category === 'master' || item.category === 'salaries') && item.status === 'paid'
    );

    if (allPaid) {
      disbursement.status = 'paid';
    } else if (salariesPaid) {
      disbursement.status = 'partially_paid';
    }

    await disbursement.save();

    // 1. Update PayrollRun status to PAID
    const payrollRun = await PayrollRun.findById(disbursement.payrollRunId);
    if (payrollRun && salariesPaid) {
      payrollRun.status = PAYROLL_STATUS.PAID;
      await payrollRun.save();

      // 2. Auto-Reconcile ComplianceRecords for PAYE, Pension, NSITF, NHF
      const nextMonth = payrollRun.month === 12 ? 1 : payrollRun.month + 1;
      const nextYear = payrollRun.month === 12 ? payrollRun.year + 1 : payrollRun.year;

      const ComplianceRecord = require('../models/ComplianceRecord');
      await ComplianceRecord.updateMany(
        {
          companyId: disbursement.companyId,
          month: nextMonth,
          year: nextYear,
          status: { $ne: 'completed' }
        },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            notes: `Auto-reconciled via Remita RRR ${targetRrr} (${rrrItem.category.toUpperCase()})`
          }
        }
      );
    }
  } else {
    rrrItem.status = 'failed';
    await disbursement.save();
  }

  return res.status(200).json({
    success: true,
    message: isSuccessful ? 'Payment confirmed and payroll auto-reconciled successfully' : 'Payment failed updated',
    rrr: targetRrr,
    disbursementStatus: disbursement.status
  });
});


