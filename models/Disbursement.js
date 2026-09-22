const mongoose = require('mongoose');

const RrrSubSchema = new mongoose.Schema({
  rrr: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['master', 'salaries', 'paye', 'pension', 'nsitf', 'nhf', 'nhis', 'statutory_unified'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['generated', 'paid', 'expired', 'failed'],
    default: 'generated'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  remitaPaymentReference: {
    type: String
  },
  beneficiaryDetails: {
    type: mongoose.Schema.Types.Mixed
  }
});

const DisbursementSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
      unique: true
    },
    paymentMode: {
      type: String,
      enum: ['unified', 'split'],
      default: 'unified'
    },
    status: {
      type: String,
      enum: ['pending', 'partially_paid', 'paid', 'failed'],
      default: 'pending'
    },
    totalOutflow: {
      type: Number,
      required: true
    },
    totalSalaries: {
      type: Number,
      required: true
    },
    totalStatutory: {
      type: Number,
      required: true
    },
    rrrs: [RrrSubSchema],
    breakdown: {
      type: mongoose.Schema.Types.Mixed
    },
    stateBillReferences: {
      type: Map,
      of: String,
      default: {}
    },
    pspBatchToken: {
      type: String,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Disbursement', DisbursementSchema);
