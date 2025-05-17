// controllers/ticket.controller.js
const Ticket = require('../models/ticket.model');
const Event = require('../models/event.model');
const User = require('../models/user.model');
const Payment = require('../models/payment.model');
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
    .populate('events.event', 'title name startTime startDate endDate venue price')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  // Format tickets for admin panel
  const formattedTickets = tickets.map(ticket => ({
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    purchasedBy: ticket.purchasedBy,
    purchaseDate: ticket.purchaseDate || ticket.createdAt,
    status: ticket.status,
    paymentStatus: ticket.paymentStatus,
    totalAmount: ticket.totalAmount,
    events: ticket.events.map(event => ({
      event: event.event,
      status: event.status,
      verifiedAt: event.verifiedAt,
      verifiedBy: event.verifiedBy
    })),
    qrCode: ticket.qrCode
  }));

  res.status(200).json({
    tickets: formattedTickets,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    }
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
    const { events, quantity } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return next(new ErrorResponse('Please provide at least one event', 400));
    }
    if (!quantity || typeof quantity !== 'number' || quantity < 1) {
      return next(new ErrorResponse('Please provide a valid quantity', 400));
    }

    // Fetch event details to calculate total price and check capacity
    const eventDocs = await Event.find({ _id: { $in: events } });
    if (eventDocs.length !== events.length) {
      return next(new ErrorResponse('One or more events not found', 404));
    }

    // Check capacity for each event
    for (const event of eventDocs) {
      // Get current ticket count for this event
      const ticketCount = await Ticket.countDocuments({
        'events.event': event._id,
        status: { $ne: 'cancelled' } // Don't count cancelled tickets
      });

      // Calculate remaining seats
      const remainingSeats = event.capacity - ticketCount;
      
      if (remainingSeats < quantity) {
        return next(new ErrorResponse(`Not enough seats available for "${event.title}". Only ${remainingSeats} seat(s) left.`, 400));
      }
    }

    // Calculate total price: sum of (each event price * quantity)
    const totalAmount = eventDocs.reduce((sum, event) => sum + (event.price * quantity), 0);

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create ticket
    const ticket = await Ticket.create({
      ticketNumber,
      purchasedBy: req.user.id,
      issuedBy: req.user.id,
      events: events.map(eventId => ({ event: eventId, status: 'registered' })),
      attendees: Array(quantity).fill({ 
        name: req.user.name,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber || '',
        age: 0
      }),
      totalAmount,
      paymentStatus: 'completed', // Bypass payment gateway for now
      status: 'active',
    });

    // Generate QR code
    const { qrCode } = await QRCodeService.generateQRCode(ticket);
    ticket.qrCode = qrCode;
    await ticket.save();

    // Optionally send email with QR code
    try {
      await EmailService.sendTicketEmail(req.user.email, ticket, qrCode);
    } catch (e) {
      console.log('Failed to send email:', e);
    }

    res.status(201).json({
      success: true,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        qrCode,
        events: eventDocs.map(event => ({
          _id: event._id,
          title: event.title,
          venue: event.venue,
          startDate: event.startDate,
          endDate: event.endDate,
        })),
        quantity,
        totalAmount,
        status: ticket.status
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify ticket
// @route   POST /api/v1/tickets/verify
// @access  Private (Staff/Admin)
exports.verifyTicket = asyncHandler(async (req, res, next) => {
  const { qrData, eventId } = req.body;

  if (!qrData) {
    return next(new ErrorResponse('QR data is required', 400));
  }

  // Find user by QR code
  const user = await User.findOne({ qrCode: qrData });
  
  if (!user) {
    return next(new ErrorResponse('Invalid QR code or user not found', 404));
  }

  // Find all active tickets for this user
  const tickets = await Ticket.find({ 
    purchasedBy: user._id,
    paymentStatus: 'completed'
  }).populate({
    path: 'events.event',
    select: 'title startDate endDate venue staffAssigned'
  });

  if (!tickets || tickets.length === 0) {
    return next(new ErrorResponse('No valid tickets found for this user', 404));
  }

  // Staff member can only verify events they are assigned to (unless they are admin)
  const staffId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  
  // Prepare user ticket data
  const now = new Date();
  let userTickets = [];
  let rejectionReason = null;

  // Process all tickets and their events
  for (const ticket of tickets) {
    for (const eventEntry of ticket.events) {
      // Get the populated event data
      const event = eventEntry.event;
      
      // Skip if event is not properly populated
      if (!event || !event._id) continue;

      // If eventId is provided, skip events that don't match
      if (eventId && event._id.toString() !== eventId) continue;

      // Check if staff is assigned to this event or is admin
      const canVerify = isAdmin || 
                        (event.staffAssigned && 
                         event.staffAssigned.some(id => id.toString() === staffId.toString()));
                         
      // Check if event is currently active (between start and end dates)
      const isEventActive = event.startDate <= now && event.endDate >= now;
      
      // Check for rejection reasons if eventId is provided
      if (eventId) {
        if (eventEntry.status === 'attended') {
          rejectionReason = 'Ticket already marked as attended for this event.';
        } else if (!isEventActive) {
          rejectionReason = 'Event is not currently active.';
        } else if (!canVerify) {
          rejectionReason = 'You are not authorized to verify this event.';
        }
      }

      userTickets.push({
        ticketId: ticket._id,
        eventId: event._id,
        eventTitle: event.title,
        eventVenue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        status: eventEntry.status,
        verifiedAt: eventEntry.verifiedAt,
        verifiedBy: eventEntry.verifiedBy,
        canVerify: canVerify,
        isEventActive: isEventActive,
        canBeMarkedAttended: canVerify && isEventActive && eventEntry.status === 'registered'
      });
    }
  }

  // If eventId is provided, ensure the user has a ticket for that event
  if (eventId && userTickets.length === 0) {
    return res.status(400).json({
      success: false,
      message: rejectionReason || 'No valid ticket found for this event.'
    });
  }

  // If eventId is provided and there is a rejection reason, return it as an error
  if (eventId && rejectionReason && userTickets.length > 0) {
    return res.status(400).json({
      success: false,
      message: rejectionReason
    });
  }

  // Create response with user and ticket information
  const response = {
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber
    },
    tickets: userTickets
  };

  res.status(200).json(response);
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
exports.updateStatusofTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id);

  if (!ticket) {
    return next(new ErrorResponse(`Ticket not found with id of ${req.params.id}`, 404));
  }
  
  ticket.status = req.body.status;
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

// @desc    Mark event as attended
// @route   POST /api/v1/tickets/mark-attended
// @access  Private (Staff/Admin)
exports.markEventAttended = asyncHandler(async (req, res, next) => {
  const { ticketId, eventId } = req.body;

  if (!ticketId || !eventId) {
    return next(new ErrorResponse('Ticket ID and Event ID are required', 400));
  }

  // Find the ticket
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return next(new ErrorResponse('Ticket not found', 404));
  }

  // Find the event in the ticket
  const eventIndex = ticket.events.findIndex(
    e => e.event.toString() === eventId
  );

  if (eventIndex === -1) {
    return next(new ErrorResponse('Event not found in ticket', 404));
  }

  // Check if event is already marked as attended
  if (ticket.events[eventIndex].status === 'attended') {
    return next(new ErrorResponse('Event already marked as attended', 400));
  }

  // Get the event to check if staff is assigned
  const event = await Event.findById(eventId);
  if (!event) {
    return next(new ErrorResponse('Event not found', 404));
  }

  // Check if staff is assigned to this event or is admin
  const staffId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  const isAssigned = event.staffAssigned && 
                     event.staffAssigned.some(id => id.toString() === staffId.toString());

  if (!isAdmin && !isAssigned) {
    return next(new ErrorResponse('You are not authorized to verify this event', 403));
  }

  // Check if event is currently active
  const now = new Date();
  const isEventActive = event.startDate <= now && event.endDate >= now;
  
  if (!isEventActive && !isAdmin) {
    return next(new ErrorResponse('Event is not currently active', 400));
  }

  // Mark event as attended
  ticket.events[eventIndex].status = 'attended';
  ticket.events[eventIndex].verifiedAt = now;
  ticket.events[eventIndex].verifiedBy = staffId;

  await ticket.save();

  // Log the attendance
  logger.info('Event marked as attended', {
    ticketId: ticket._id,
    eventId: eventId,
    userId: ticket.purchasedBy,
    verifiedBy: staffId
  });

  res.status(200).json({
    success: true,
    data: ticket
  });
});

