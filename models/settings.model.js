const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    maxlength: [100, 'Site name cannot be more than 100 characters']
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  enableQRScanning: {
    type: Boolean,
    default: true
  },
  requireEmailVerification: {
    type: Boolean,
    default: true
  },
  allowTicketTransfers: {
    type: Boolean,
    default: true
  },
  enableEmailNotifications: {
    type: Boolean,
    default: true
  },
  enableSMSNotifications: {
    type: Boolean,
    default: false
  },
  smsProvider: {
    type: String,
    enum: ['twilio', 'nexmo', 'none'],
    default: 'none'
  },
  smsApiKey: {
    type: String,
    select: false
  },
  smsApiSecret: {
    type: String,
    select: false
  },
  emailProvider: {
    type: String,
    enum: ['smtp', 'sendgrid', 'mailgun'],
    default: 'smtp'
  },
  emailApiKey: {
    type: String,
    select: false
  },
  emailFrom: {
    type: String,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  emailHost: String,
  emailPort: Number,
  emailUsername: {
    type: String,
    select: false
  },
  emailPassword: {
    type: String,
    select: false
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'System is under maintenance. Please try again later.'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // New: Default entry pass expiration (in days)
  entryPassExpirationDays: {
    type: Number,
    default: 30 // Default to 30 days if not set
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.pre('save', async function(next) {
  const count = await this.constructor.countDocuments();
  if (count > 0 && this.isNew) {
    throw new Error('Settings document already exists');
  }
  next();
});

module.exports = mongoose.model('Settings', settingsSchema); 