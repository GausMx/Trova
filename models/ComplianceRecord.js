const mongoose = require('mongoose');

const ComplianceRecordSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required']
    },
    obligationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StatutoryCalendar',
      required: [true, 'Obligation ID is required']
    },
    month: {
      type: Number,
      required: [true, 'Month is required']
    },
    year: {
      type: Number,
      required: [true, 'Year is required']
    },
    status: {
      type: String,
      enum: ['pending', 'due_soon', 'overdue', 'completed'],
      default: 'pending'
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Ensure a company can only have one compliance record per obligation and period
ComplianceRecordSchema.index({ companyId: 1, obligationId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceRecord', ComplianceRecordSchema);
