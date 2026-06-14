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
  // Deductions (Monthly)
  taxDeduction: { type: Number, required: true },
  pensionDeduction: { type: Number, required: true },
  nhfDeduction: { type: Number, required: true },
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
      net: { type: Number, default: 0 }
    },
    employees: [PayrollEmployeeSchema]
  },
  {
    timestamps: true
  }
);

// Create compound index for companyId + month + year to prevent duplicate payroll runs
PayrollRunSchema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
