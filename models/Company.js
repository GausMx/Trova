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
      default: SUBSCRIPTION_TIERS.FREE
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

module.exports = mongoose.model('Company', CompanySchema);
