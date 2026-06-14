const mongoose = require('mongoose');
const { EMPLOYEE_STATUS } = require('../config/constants');

const EmployeeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Employee must belong to a company']
    },
    staffId: {
      type: String,
      unique: true
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUS),
      default: EMPLOYEE_STATUS.ACTIVE
    },
    hireDate: {
      type: Date,
      default: Date.now
    },
    // Salary components stored in Naira (float)
    basicSalary: {
      type: Number,
      required: [true, 'Basic salary is required'],
      default: 0
    },
    housingAllowance: {
      type: Number,
      default: 0
    },
    transportAllowance: {
      type: Number,
      default: 0
    },
    otherAllowances: {
      type: Number,
      default: 0
    },
    // Bank details
    bankName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    accountName: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for fullName
EmployeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save hook to generate Staff ID
EmployeeSchema.pre('save', async function (next) {
  if (this.isNew && !this.staffId) {
    try {
      const Company = mongoose.model('Company');
      const company = await Company.findById(this.companyId);
      if (!company) {
        return next(new Error('Associated company not found'));
      }

      // Generate prefix: strip non-alphabetic, take first 3, uppercase, pad to 3 chars
      const cleanName = company.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
      const prefix = (cleanName.substring(0, 3) || 'EMP').padEnd(3, 'X');

      // Get count of employees for sequence
      const count = await mongoose.model('Employee').countDocuments({ companyId: this.companyId });
      const sequenceNum = String(count + 1).padStart(3, '0');

      this.staffId = `${prefix}-${sequenceNum}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Employee', EmployeeSchema);
