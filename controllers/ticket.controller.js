// controllers/ticket.controller.js
const Ticket = require('../models/ticket.model');
const Event = require('../models/event.model');
const Payment = require('../models/payment.model');
const User = require('../models/user.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const qrcodeService = require('../services/qrcode.service');
const pdfService = require('../services/pdf.service');
const mailService = require('../services/mail.service');
const { getPagination, createPaginationMetadata } = require('../utils/helpers');
const QRCodeService = require('../services/qrcode.service');
const EmailService = require('../services/email.service');

// @desc    Get all tickets
// @route   GET /api/v1/tickets
// @access  Private/Admin
exports.getTickets = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  // Build filter
  const filter = {};
  
  // Filter by exhibition
  if (req.query.exhibition) {
    filter.exhibition = req.query.exhibition;
  }
  
  // Filter by payment status
  if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }
  
  // Filter by ticket status
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .populate('purchasedBy', 'name email')
    .populate('issuedBy', 'name')
    
    .populate('events.event', 'name startTime')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: tickets,
  });
});

// @desc    Get tickets for current user
// @route   GET /api/v1/tickets/me
// @access  Private
exports.getMyTickets = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  const filter = { purchasedBy: req.user.id };
  
  // Filter by status if provided
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .populate('exhibition', 'name venue')
    .populate('events.event', 'name startTime endTime location')
    .skip(skip)
    .limit(limit)
    .sort('-purchaseDate');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: tickets,
  });
});

// @desc    Get single ticket
// @route   GET /api/v1/tickets/:id
// @access  Private
exports.getTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('purchasedBy', 'name email phoneNumber')
    .populate('issuedBy', 'name')
    .populate('exhibition', 'name venue')
    .populate('events.event', 'name startTime endTime location')
    .populate('events.verifiedBy', 'name');

  if (!ticket) {
    return next(new ErrorResponse(`Ticket not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to view this ticket
  if (req.user.role !== 'admin' && req.user.role !== 'staff' && 
      ticket.purchasedBy._id.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to access this ticket', 403));
  }

  res.status(200).json({
    success: true,
    data: ticket,
  });
});

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private
exports.createTicket = async (req, res, next) => {
  try {
    const { events, attendees, totalAmount } = req.body;

    if (!events || !attendees || !totalAmount) {
      return next(new ErrorResponse('Please provide all required fields', 400));
    }

    const ticket = await Ticket.create({
      purchasedBy: req.user.id,
      issuedBy: req.user.id,
      exhibition: events[0].event.exhibition, // Assuming all events are from the same exhibition
      events: events.map(event => ({
        event: event.event._id,
        verified: false,
      })),
      attendees,
      totalAmount,
    });

    // Generate QR code
    const { qrCode } = await QRCodeService.generateQRCode(ticket);

    // Update ticket with QR code
    ticket.qrCode = qrCode;
    await ticket.save();

    // Send email with QR code
    await EmailService.sendTicketEmail(req.user.email, ticket, qrCode);

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify ticket
// @route   POST /api/v1/tickets/verify
// @access  Private (Staff/Admin)
exports.verifyTicket = asyncHandler(async (req, res, next) => {
  const { qrData } = req.body;

  if (!qrData) {
    return next(new ErrorResponse('QR data is required', 400));
  }

  const { isValid, ticket, error, statusInfo } = await QRCodeService.verifyQRCode(qrData);

  if (!isValid) {
    return next(new ErrorResponse(error || 'Invalid ticket', 400));
  }

  // Ticket exists - let's return all the details without changing status
  try {
    // Populate additional fields for complete ticket details
    await ticket.populate([
      { path: 'purchasedBy', select: 'name email phoneNumber' },
      { path: 'exhibition', select: 'name venue description' },
      { path: 'events.event', select: 'name startTime endTime location description' }
    ]);

    // Create detailed response with all ticket information
    const response = {
      success: true,
      ticket: {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        paymentStatus: ticket.paymentStatus,
        exhibition: ticket.exhibition,
        purchasedBy: ticket.purchasedBy,
        events: ticket.events,
        attendees: ticket.attendees,
        totalAmount: ticket.totalAmount,
        purchaseDate: ticket.purchaseDate,
        qrCode: ticket.qrCode
      }
    };

    // Add status info to response
    if (statusInfo) {
      response.canBeUsed = statusInfo.canBeUsed;
      response.statusMessage = statusInfo.statusMessage;
    }

    // Log verification attempt without changing status
    logger.info('Ticket verified and details shown', { 
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      verifiedBy: req.user?.id || 'system'
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error processing ticket:', error);
    return next(new ErrorResponse('Error processing ticket: ' + error.message, 500));
  }
});

// @desc    Verify event in ticket
// @route   POST /api/tickets/verify-event
// @access  Private (Staff/Admin)
exports.verifyEvent = async (req, res, next) => {
  try {
    const { ticketId, eventId } = req.body;

    if (!ticketId || !eventId) {
      return next(new ErrorResponse('Ticket ID and Event ID are required', 400));
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    const eventIndex = ticket.events.findIndex(
      event => event.event.toString() === eventId
    );

    if (eventIndex === -1) {
      return next(new ErrorResponse('Event not found in ticket', 404));
    }

    if (ticket.events[eventIndex].verified) {
      return next(new ErrorResponse('Event already verified', 400));
    }

    ticket.events[eventIndex].verified = true;
    ticket.events[eventIndex].verifiedAt = Date.now();
    ticket.events[eventIndex].verifiedBy = req.user.id;

    await ticket.save();

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add events to ticket
// @route   PUT /api/tickets/:id/events
// @access  Private
exports.addEvents = async (req, res, next) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return next(new ErrorResponse('Please provide events array', 400));
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    // Check if user owns the ticket or is staff/admin
    if (
      ticket.purchasedBy.toString() !== req.user.id &&
      !['staff', 'admin'].includes(req.user.role)
    ) {
      return next(new ErrorResponse('Not authorized to modify this ticket', 403));
    }

    // Add new events
    const newEvents = events.map(event => ({
      event: event._id,
      verified: false,
    }));

    ticket.events.push(...newEvents);

    // Update total amount
    const totalAmount = ticket.events.reduce((sum, event) => {
      const eventPrice = event.event.ticketPrice;
      return sum + eventPrice * ticket.attendees.length;
    }, 0);

    ticket.totalAmount = totalAmount;
    await ticket.save();

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel ticket
// @route   PUT /api/v1/tickets/:id/cancel
// @access  Private/Admin
exports.cancelTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    return next(new ErrorResponse(`Ticket not found with id of ${req.params.id}`, 404));
  }
  
  ticket.status = 'cancelled';
  await ticket.save();

  res.status(200).json({
    success: true,
    data: ticket,
  });
});

// @desc    Get ticket by QR code
// @route   POST /api/v1/tickets/verify-qr
// @access  Private/Staff & Admin
exports.getTicketByQRCode = asyncHandler(async (req, res, next) => {
  const { qrCode } = req.body;
  
  if (!qrCode) {
    return next(new ErrorResponse('QR code is required', 400));
  }
  
  const ticket = await Ticket.findOne({ qrCode })
    .populate('purchasedBy', 'name email phoneNumber')
    .populate('exhibition', 'name venue')
    .populate('events.event', 'name startTime endTime location')
    .populate('events.verifiedBy', 'name');
  
  if (!ticket) {
    return next(new ErrorResponse('Invalid QR code or ticket not found', 404));
  }

  res.status(200).json({
    success: true,
    data: ticket,
  });
});

// @desc    Mark ticket as used (new endpoint)
// @route   POST /api/v1/tickets/:id/mark-used
// @access  Private (Staff/Admin only)
exports.markTicketAsUsed = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.id;
  
  // Check if user is staff or admin
  if (!req.user || (req.user.role !== 'staff' && req.user.role !== 'admin')) {
    return next(new ErrorResponse('Only staff or admin can mark tickets as used', 403));
  }
  
  const ticket = await Ticket.findById(ticketId);
  
  if (!ticket) {
    return next(new ErrorResponse('Ticket not found', 404));
  }
  
  // Set status to used
  ticket.status = 'used';
  await ticket.save();
  
  logger.info('Ticket manually marked as used', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    markedBy: req.user.id
  });
  
  res.status(200).json({
    success: true,
    data: ticket,
    message: 'Ticket successfully marked as used'
  });
});

