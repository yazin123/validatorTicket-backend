const EntryPass = require('../models/entrypass.model');
const Settings = require('../models/settings.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const Payment = require('../models/payment.model');

// @desc    Purchase or increment entry pass
// @route   POST /api/v1/entrypass/purchase
// @access  Private
exports.purchaseEntryPass = asyncHandler(async (req, res, next) => {
  const { headCount, amount, paymentId, transactionInfo } = req.body;
  if (!headCount || headCount < 1) {
    return next(new ErrorResponse('Head count must be at least 1', 400));
  }
  if (!amount || !paymentId) {
    return next(new ErrorResponse('Amount and paymentId are required', 400));
  }

  // Get expiration days from settings
  const settings = await Settings.findOne();
  const expirationDays = settings?.entryPassExpirationDays || 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

  // Check for existing active entry pass
  let entryPass = await EntryPass.findOne({ user: req.user._id, status: 'active', expiresAt: { $gt: now } });
  if (entryPass) {
    // Increment head count and extend expiration if needed
    entryPass.headCount += headCount;
    entryPass.amount += amount;
    entryPass.paymentId = paymentId;
    entryPass.transactionInfo = transactionInfo;
    if (expiresAt > entryPass.expiresAt) entryPass.expiresAt = expiresAt;
    await entryPass.save();
  } else {
    entryPass = await EntryPass.create({
      user: req.user._id,
      headCount,
      amount,
      paymentId,
      transactionInfo,
      purchasedAt: now,
      expiresAt,
      status: 'active'
    });
  }
  res.status(201).json({ success: true, entryPass });
});

// @desc    Get current user's entry pass
// @route   GET /api/v1/entrypass/me
// @access  Private
exports.getMyEntryPass = asyncHandler(async (req, res, next) => {
  const now = new Date();
  const entryPass = await EntryPass.findOne({ user: req.user._id, status: 'active', expiresAt: { $gt: now } });
  res.status(200).json({ success: true, entryPass });
}); 