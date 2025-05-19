const mongoose = require('mongoose');

const entryPassSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  headCount: {
    type: Number,
    required: true,
    min: 1
  },
  amount: {
    type: Number,
    required: true
  },
  paymentId: {
    type: String,
    required: true
  },
  transactionInfo: {
    type: Object,
    default: {}
  },
  purchasedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EntryPass', entryPassSchema); 