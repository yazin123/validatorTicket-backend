// models/ticket.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const attendeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Attendee name is required'],
  },
  email: {
    type: String,
  },
  phoneNumber: {
    type: String,
  },
  age: {
    type: Number,
  }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: [true, 'Ticket number is required'],
    unique: true,
  },
  qrCode: {
    type: String,
    required: [true, 'QR code is required'],
    unique: true,
  },
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Staff reference is required'],
  },
  events: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  }],
  attendees: [attendeeSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'paid'],
    default: 'pending',
  },
  paymentId: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'valid', 'used', 'expired', 'cancelled'],
    default: 'active',
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate unique ticket number and QR code before save
ticketSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next();
  }
  
  // Generate ticket number
  const timestamp = Date.now().toString();
  const randomStr = crypto.randomBytes(3).toString('hex');
  this.ticketNumber = `TIX-${timestamp.substring(timestamp.length - 6)}-${randomStr.toUpperCase()}`;
  
  // Generate unique QR code value
  this.qrCode = crypto.randomBytes(20).toString('hex');
  
  next();
});

ticketSchema.pre('findOneAndUpdate', function () {
  this.set({ updatedAt: Date.now() });
});

module.exports = mongoose.model('Ticket', ticketSchema);

