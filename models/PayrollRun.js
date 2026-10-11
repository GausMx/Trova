const mongoose = require('mongoose');
const { PAYROLL_STATUS } = require('../config/constants');

const PayrollEmployeeSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  staffId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  // Salary Breakdown (Monthly)
  basicSalary: { type: Number, required: true },
  housingAllowance: { type: Number, default: 0 },
  transportAllowance: { type: Number, default: 0 },
  otherAllowances: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  // Attendance & Proration
  workingDaysInMonth: { type: Number, required: true },
  daysAbsent: { type: Number, default: 0 },
  halfDays: { type: Number, default: 0 },
  daysWorked: { type: Number, required: true },
  proratedGross: { type: Number, required: true },
  // Deductions (Monthly)
  taxDeduction: { type: Number, required: true },
  pensionDeduction: { type: Number, required: true },
  nhfDeduction: { type: Number, required: true },
  nhisDeduction: { type: Number, default: 0 },
  // Employer Overhead (Monthly)
  employerPensionContribution: { type: Number, default: 0 },
  employerNhisContribution: { type: Number, default: 0 },
  nsitfContribution: { type: Number, default: 0 },
  itfContribution: { type: Number, default: 0 },
  // Net Salary (Monthly)
  netSalary: { type: Number, required: true }
});

const PayrollRunSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Payroll run must belong to a company']
    },
    month: {
      type: Number,
      required: [true, 'Payroll run month is required (1-12)'],
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: [true, 'Payroll run year is required']
    },
    status: {
      type: String,
      enum: Object.values(PAYROLL_STATUS),
      default: PAYROLL_STATUS.DRAFT
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Processor user ID is required']
    },
    totals: {
      gross: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      pension: { type: Number, default: 0 },
      nhf: { type: Number, default: 0 },
      nhis: { type: Number, default: 0 },
      employerPension: { type: Number, default: 0 },
      employerNhis: { type: Number, default: 0 },
      nsitf: { type: Number, default: 0 },
      itf: { type: Number, default: 0 },
      net: { type: Number, default: 0 }
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    paidAt: {
      type: Date
    },
    settlementReference: {
      type: String,
      trim: true
    },
    PspBatchToken: {
      type: String,
      default: null
    },
    PspValidationStatus: {
      type: String,
      enum: ['PENDING', 'VALIDATED', 'FAILED'],
      default: 'PENDING'
    },
    PspValidationErrors: [
      {
        staffId: String,
        name: String,
        rsaPin: String,
        pfaCode: String,
        error: String
      }
    ],
    auditTrail: [
      {
        event: {
          type: String,
          enum: [
            'COMPUTED',
            'ATTENDANCE_ADJUSTED',
            'PSSP_VALIDATED',
            'APPROVED',
            'RRR_GENERATED',
            'PAYMENT_SETTLED',
            'BANK_FILE_DOWNLOADED',
            'RECONCILED'
          ],
          required: true
        },
        title: { type: String, required: true },
        description: { type: String, required: true },
        performedBy: {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          userName: String,
          userRole: String
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    employees: [PayrollEmployeeSchema]
  },
  {
    timestamps: true
  }
);

// Helper method to append audit trail events
PayrollRunSchema.methods.addAuditEvent = function (eventData) {
  if (!this.auditTrail) {
    this.auditTrail = [];
  }
  this.auditTrail.push({
    ...eventData,
    timestamp: new Date()
  });
};

// Create compound index for companyId + month + year to prevent duplicate payroll runs
PayrollRunSchema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });
// Performance index: Reverse chronological retrieval of company payroll runs (zero-in-memory sorting)
PayrollRunSchema.index({ companyId: 1, year: -1, month: -1 });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);

