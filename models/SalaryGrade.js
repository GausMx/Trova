const mongoose = require('mongoose');

const SalaryGradeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Salary grade must belong to a company']
    },
    name: {
      type: String,
      required: [true, 'Salary grade name is required'],
      trim: true
    },
    level: {
      type: Number,
      default: 1
    },
    basicSalary: {
      type: Number,
      required: [true, 'Basic salary is required'],
      min: [0, 'Basic salary cannot be negative']
    },
    housingAllowance: {
      type: Number,
      default: 0,
      min: [0, 'Housing allowance cannot be negative']
    },
    transportAllowance: {
      type: Number,
      default: 0,
      min: [0, 'Transport allowance cannot be negative']
    },
    otherAllowances: {
      type: Number,
      default: 0,
      min: [0, 'Other allowances cannot be negative']
    },
    description: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for gross salary
SalaryGradeSchema.virtual('grossSalary').get(function () {
  return this.basicSalary + this.housingAllowance + this.transportAllowance + this.otherAllowances;
});

// Ensure grade names are unique within each company tenant
SalaryGradeSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SalaryGrade', SalaryGradeSchema);
