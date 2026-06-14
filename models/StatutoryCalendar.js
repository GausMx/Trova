const mongoose = require('mongoose');

const StatutoryCalendarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Remittance deadline title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    authority: {
      type: String,
      required: [true, 'Tax/remittance authority is required (e.g., LIRS, FIRS, PenCom)'],
      trim: true
    },
    remittanceType: {
      type: String,
      required: [true, 'Remittance type is required (e.g., PAYE, Pension, NHF)'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StatutoryCalendar', StatutoryCalendarSchema);
