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
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
  showId: {
    type: String,
    required: [true, 'Show ID is required'],
    },
  headCount: {
    type: Number,
    required: [true, 'Head count is required'],
    min: [1, 'Head count must be at least 1']
  },
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
  qrCode: {
    type: String,
    required: true,
    unique: true,
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

// Generate unique ticket number before save
ticketSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next();
  }
  
  // Generate ticket number
  const timestamp = Date.now().toString();
  const randomStr = crypto.randomBytes(3).toString('hex');
  this.ticketNumber = `TIX-${timestamp.substring(timestamp.length - 6)}-${randomStr.toUpperCase()}`;
  
  next();
});

ticketSchema.pre('findOneAndUpdate', function () {
  this.set({ updatedAt: Date.now() });
});

module.exports = mongoose.model('Ticket', ticketSchema);

