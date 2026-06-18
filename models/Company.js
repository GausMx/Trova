const mongoose = require('mongoose');
const { SUBSCRIPTION_TIERS, COMPANY_STATUS } = require('../config/constants');

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      unique: true
    },
    industry: {
      type: String,
      trim: true
    },
    subscriptionTier: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TIERS),
      default: SUBSCRIPTION_TIERS.GROWTH
    },
    isTrial: {
      type: Boolean,
      default: true
    },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'unpaid', 'cancelled'],
      default: 'trial'
    },
    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    inviteCode: {
      type: String,
      unique: true
    },
    status: {
      type: String,
      enum: Object.values(COMPANY_STATUS),
      default: COMPANY_STATUS.ACTIVE
    },
    address: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Synchronize isTrial and subscriptionStatus
CompanySchema.pre('save', function (next) {
  if (this.isNew && !this.inviteCode) {
    this.inviteCode = 'TRV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  if (this.isModified('isTrial') || this.isNew) {
    if (this.isTrial === false && this.subscriptionStatus === 'trial') {
      this.subscriptionStatus = 'active';
    } else if (this.isTrial === true && this.subscriptionStatus !== 'trial') {
      this.subscriptionStatus = 'trial';
    }
  }
  if (this.isModified('subscriptionStatus')) {
    if (this.subscriptionStatus === 'trial') {
      this.isTrial = true;
    } else {
      this.isTrial = false;
    }
  }
  next();
});

module.exports = mongoose.model('Company', CompanySchema);
