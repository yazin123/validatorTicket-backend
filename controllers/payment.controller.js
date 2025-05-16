// controllers/payment.controller.js
const Payment = require('../models/payment.model');
const Ticket = require('../models/ticket.model');
const User = require('../models/user.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');
const mailService = require('../services/mail.service');

// Mock payment system
const mockPaymentSystem = {
  createOrder: async (amount) => {
    // Generate a mock order ID
    const orderId = `mock_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: orderId,
      amount: amount,
      currency: 'INR'
    };
  },

  verifyPayment: (orderId, paymentId, signature) => {
    // For testing, we'll accept any signature
    return true;
  },

  generateMockPaymentId: () => {
    return `mock_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  generateMockSignature: (orderId, paymentId) => {
    return `mock_signature_${orderId}_${paymentId}`;
  }
};

// @desc    Get all payments (admin)
// @route   GET /api/v1/payments
// @access  Private/Admin
exports.getPayments = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  // Build filter
  const filter = {};
  
  // Filter by user
  if (req.query.user) {
    filter.user = req.query.user;
  }
  
  // Filter by status
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('user', 'name email')
    .populate('ticket', 'ticketNumber events')
    .skip(skip)
    .limit(limit)
    .sort('-transactionDate');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: payments,
  });
});

// @desc    Get user payments
// @route   GET /api/v1/payments/me
// @access  Private
exports.getMyPayments = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  const filter = { user: req.user.id };
  
  // Filter by status if provided
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('ticket', 'ticketNumber events totalAmount')
    .skip(skip)
    .limit(limit)
    .sort('-transactionDate');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: payments,
  });
});

// @desc    Create payment order
// @route   POST /api/v1/payments/create-order
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  try {
    const { events, attendees, totalAmount } = req.body;

    // Validate required fields
    if (!events || !Array.isArray(events) || events.length === 0) {
      return next(new ErrorResponse('Please provide valid events array', 400));
    }

    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return next(new ErrorResponse('Please provide valid attendees array', 400));
    }

    if (!totalAmount || typeof totalAmount !== 'number' || totalAmount <= 0) {
      return next(new ErrorResponse('Please provide a valid total amount', 400));
    }

    // Validate each event
    for (const event of events) {
      if (!event.event || !event.quantity || event.quantity <= 0) {
        return next(new ErrorResponse('Each event must have a valid event ID and quantity', 400));
      }
    }

    // Validate each attendee
    for (const attendee of attendees) {
      if (!attendee.name || !attendee.email || !attendee.phoneNumber) {
        return next(new ErrorResponse('Each attendee must have name, email, and phone number', 400));
      }
    }

    // Check if number of attendees matches total quantity
    const totalQuantity = events.reduce((sum, event) => sum + event.quantity, 0);
    if (totalQuantity !== attendees.length) {
      return next(new ErrorResponse('Number of attendees must match total quantity', 400));
    }

    // Generate ticket number and QR code
    const timestamp = Date.now().toString();
    const randomStr = crypto.randomBytes(3).toString('hex');
    const ticketNumber = `TIX-${timestamp.substring(timestamp.length - 6)}-${randomStr.toUpperCase()}`;
    const qrCode = crypto.randomBytes(20).toString('hex');

    // Create ticket first
    const ticket = await Ticket.create({
      user: req.user.id,
      purchasedBy: req.user.id,
      issuedBy: req.user.id, // For now, using the same user as issuer
      events: events.map(event => ({
        event: event.event,
        quantity: event.quantity
      })),
      attendees,
      totalAmount,
      status: 'active', // Set to active as per model enum
      paymentStatus: 'pending', // Payment status can be pending
      ticketNumber,
      qrCode
    });

    // Create mock order
    const order = await mockPaymentSystem.createOrder(totalAmount);

    logger.info('Mock payment order created successfully', { 
      orderId: order.id, 
      amount: order.amount,
      ticketId: ticket._id 
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        qrCode: ticket.qrCode,
        // Include mock payment details for testing
        mockPaymentId: mockPaymentSystem.generateMockPaymentId(),
        mockSignature: mockPaymentSystem.generateMockSignature(order.id, mockPaymentSystem.generateMockPaymentId())
      }
    });
  } catch (error) {
    logger.error('Error creating payment order:', error);
    return next(new ErrorResponse('Error creating payment order', 500));
  }
});

// @desc    Verify payment and update ticket
// @route   POST /api/v1/payments/verify
// @access  Private
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  try {
    const { paymentId, orderId, signature, ticketId } = req.body;

    // Validate required fields
    if (!paymentId || !orderId || !signature || !ticketId) {
      return next(new ErrorResponse('Please provide payment ID, order ID, signature, and ticket ID', 400));
    }

    // Verify mock payment
    const isValid = mockPaymentSystem.verifyPayment(orderId, paymentId, signature);
    if (!isValid) {
      logger.warn('Invalid payment signature', { orderId, paymentId });
      return next(new ErrorResponse('Invalid payment signature', 400));
    }

    // Find and update ticket
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    // Generate ticket number and QR code only after successful payment
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const qrCode = crypto.createHash('sha256')
      .update(`${ticketNumber}-${ticket._id}-${Date.now()}`)
      .digest('hex');

    // Update ticket with payment status and generated codes
    ticket.status = 'active';
    ticket.paymentStatus = 'completed';
    ticket.ticketNumber = ticketNumber;
    ticket.qrCode = qrCode;
    await ticket.save();

    // Create payment record
    const payment = await Payment.create({
      user: req.user.id,
      ticket: ticket._id,
      orderId,
      paymentId,
      amount: ticket.totalAmount,
      status: 'completed'
    });

    // Send email with ticket details
    try {
      const user = await User.findById(req.user.id);
      if (user && mailService.sendTicketConfirmationEmail) {
        await mailService.sendTicketConfirmationEmail(ticket, user);
      }
    } catch (emailError) {
      logger.error('Error sending ticket confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    logger.info('Payment verified and ticket updated successfully', { 
      ticketId: ticket._id,
      paymentId: payment._id,
      ticketNumber,
      qrCode
    });

    res.status(200).json({
      success: true,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        qrCode: ticket.qrCode,
        status: ticket.status,
        events: ticket.events,
        attendees: ticket.attendees
      }
    });
  } catch (error) {
    logger.error('Error verifying payment:', error);
    return next(new ErrorResponse('Error verifying payment', 500));
  }
});

// @desc    Get payment history
// @route   GET /api/v1/payments/history
// @access  Private/Admin
exports.getPaymentHistory = asyncHandler(async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('ticket');

    logger.info('Payment history retrieved successfully', { count: payments.length });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    logger.error('Error fetching payment history:', error);
    return next(new ErrorResponse('Error fetching payment history', 500));
  }
});

// @desc    Process refund
// @route   POST /api/v1/payments/refund
// @access  Private/Admin
exports.processRefund = asyncHandler(async (req, res, next) => {
  try {
    const { ticketId, amount } = req.body;

    if (!ticketId || !amount) {
      return next(new ErrorResponse('Please provide ticket ID and amount', 400));
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    const payment = await Payment.findOne({ ticket: ticketId });
    if (!payment) {
      return next(new ErrorResponse('Payment not found', 404));
    }

    // Process mock refund
    const refundId = `mock_refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update ticket and payment status
    ticket.status = 'refunded';
    ticket.paymentStatus = 'refunded';
    await ticket.save();

    payment.status = 'refunded';
    payment.refundId = refundId;
    await payment.save();

    // Send refund confirmation email
    try {
      const user = await User.findById(ticket.purchasedBy);
      if (user && mailService.sendRefundConfirmationEmail) {
        await mailService.sendRefundConfirmationEmail(ticket, user);
      }
    } catch (emailError) {
      logger.error('Error sending refund confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    logger.info('Mock refund processed successfully', { 
      ticketId,
      paymentId: payment._id,
      refundId
    });

    res.status(200).json({
      success: true,
      data: {
        refundId,
        amount: amount,
        status: 'refunded'
      }
    });
  } catch (error) {
    logger.error('Error processing refund:', error);
    return next(new ErrorResponse('Error processing refund', 500));
  }
});