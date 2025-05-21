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
const EntryPass = require('../models/entrypass.model');
const QRCode = require('qrcode');

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
    .populate('event', 'title name startTime startDate endDate venue price')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  // Format tickets for admin panel (new schema)
  const formattedTickets = tickets.map(ticket => ({
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    purchasedBy: ticket.purchasedBy,
    purchaseDate: ticket.purchaseDate || ticket.createdAt,
    status: ticket.status,
    paymentStatus: ticket.paymentStatus,
    totalAmount: ticket.totalAmount,
    event: ticket.event,
    showId: ticket.showId,
    headCount: ticket.headCount,
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
    .populate('event', 'title startDate endDate venue price')
    .skip(skip)
    .limit(limit)
    .sort('-purchaseDate');

  // Format tickets for user (new schema)
  const formattedTickets = tickets.map(ticket => ({
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    event: ticket.event,
    showId: ticket.showId,
    headCount: ticket.headCount,
    status: ticket.status,
    paymentStatus: ticket.paymentStatus,
    totalAmount: ticket.totalAmount,
    qrCode: ticket.qrCode,
    purchaseDate: ticket.purchaseDate || ticket.createdAt
  }));

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: formattedTickets,
  });
});

// @desc    Get single ticket
// @route   GET /api/v1/tickets/:id
// @access  Private
exports.getTicket = asyncHandler(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('purchasedBy', 'name email phoneNumber')
    .populate('issuedBy', 'name')
    .populate('event', 'name startTime endTime location');

  if (!ticket) {
    return next(new ErrorResponse(`Ticket not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to view this ticket
  if (req.user.role !== 'admin' && req.user.role !== 'staff' && 
      ticket.purchasedBy._id.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to access this ticket', 403));
  }

  // Format ticket (new schema)
  const formattedTicket = {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    event: ticket.event,
    showId: ticket.showId,
    headCount: ticket.headCount,
    status: ticket.status,
    paymentStatus: ticket.paymentStatus,
    totalAmount: ticket.totalAmount,
    qrCode: ticket.qrCode,
    purchasedBy: ticket.purchasedBy,
    issuedBy: ticket.issuedBy,
    purchaseDate: ticket.purchaseDate || ticket.createdAt
  };

  res.status(200).json({
    success: true,
    data: formattedTicket,
  });
});

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private
exports.createTicket = async (req, res, next) => {
  // DEPRECATED: This endpoint is not supported with the new ticket schema. Use /api/v1/tickets/book instead.
  return res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Please use /api/v1/tickets/book for ticket booking.'
  });
};

// @desc    Verify ticket
// @route   POST /api/v1/tickets/verify
// @access  Private (Staff/Admin)
exports.verifyTicket = asyncHandler(async (req, res, next) => {
  const { qrData, eventId } = req.body;

  if (!qrData) {
    return next(new ErrorResponse('QR data is required', 400));
  }

  logger.info('Verifying ticket with data', { 
    qrDataType: typeof qrData,
    isDataUrl: typeof qrData === 'string' && qrData.startsWith('data:image'),
    eventId 
  });

  // Find ticket using multiple lookup methods
  let ticket;
  let allTickets = [];

  try {
    // If no ticket is found by QR code directly, let's try a broader approach
    // Get all tickets for the specified event
    if (eventId) {
      allTickets = await Ticket.find({ event: eventId })
        .populate('purchasedBy', 'name email phoneNumber')
        .populate('event', 'title startDate endDate venue staffAssigned');
      
      logger.info(`Found ${allTickets.length} tickets for event ${eventId}`);
    }

    // Method 1: Try direct ticket lookup by QR code
    if (typeof qrData === 'string') {
      if (qrData.startsWith('data:image')) {
        // This is a data URL QR code
        ticket = await Ticket.findOne({ qrCode: qrData })
          .populate('purchasedBy', 'name email phoneNumber')
          .populate('event', 'title startDate endDate venue staffAssigned');
        
        logger.info('Direct data URL lookup result:', { found: !!ticket });
      } else if (qrData.includes('TIX-')) {
        // This looks like a ticket number
        ticket = await Ticket.findOne({ ticketNumber: qrData })
          .populate('purchasedBy', 'name email phoneNumber')
          .populate('event', 'title startDate endDate venue staffAssigned');
        
        logger.info('Ticket number lookup result:', { found: !!ticket });
      } else if (qrData.includes('|')) {
        // This is a pipe-delimited format, which is likely the decoded content from a QR code
        // Example: eventId|showId|userId|timestamp|random
        const parts = qrData.split('|');
        if (parts.length >= 3) {
          const scanEventId = parts[0];
          const scanShowId = parts[1];
          const scanUserId = parts[2];

          logger.info('Extracted pipe-delimited parts:', { 
            scanEventId, scanShowId, scanUserId, eventId 
          });
          
          // If eventId is specified, make sure it matches
          if (!eventId || scanEventId === eventId) {
            // Try to find a ticket that matches these parameters
            const matchCriteria = { 
              event: scanEventId,
              showId: scanShowId,
              purchasedBy: scanUserId
            };
            
            ticket = await Ticket.findOne(matchCriteria)
              .populate('purchasedBy', 'name email phoneNumber')
              .populate('event', 'title startDate endDate venue staffAssigned');
            
            logger.info('Pipe-delimited lookup result:', { 
              criteria: matchCriteria,
              found: !!ticket 
            });
          }
        }
      }
    }

    // Method the event-specific tickets to find a match
    if (!ticket && allTickets.length > 0) {
      // Helper function to extract QR code content from data URL
      const extractQrContent = (dataUrl) => {
        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
          return null;
        }
        
        try {
          // This is a simplified approach - in a real implementation, you'd need to actually
          // decode the base64 image and extract QR content using a library
          // For now, we'll just check if any ticket has this QR code
          return dataUrl;
        } catch (err) {
          logger.error('Error extracting QR content', { error: err.message });
          return null;
        }
      };

      // Check if any ticket has matching data
      if (typeof qrData === 'string' && qrData.includes('|')) {
        // If we have a pipe-delimited string, try to match parts
        const [scanEventId, scanShowId, scanUserId] = qrData.split('|');
        
        ticket = allTickets.find(t => 
          t.event._id.toString() === scanEventId && 
          t.showId === scanShowId && 
          t.purchasedBy._id.toString() === scanUserId
        );
        
        logger.info('Finding matching ticket by pipe parts in all tickets:', { found: !!ticket });
      }
    }

    // If still no ticket found, try one last approach for events
    if (!ticket && eventId) {
      // Try to find the ticket by event and any identifying info
      logger.info('Trying last resort lookup for event:', eventId);
      
      // Look for a ticket with matching eventId
      if (typeof qrData === 'string') {
        // If it's a pipe-delimited string, extract the user ID
        if (qrData.includes('|')) {
          const parts = qrData.split('|');
          if (parts.length >= 3) {
            const userId = parts[2];
            ticket = await Ticket.findOne({ 
                event: eventId, 
                purchasedBy: userId,
                status: { $ne: 'cancelled' }
              })
              .populate('purchasedBy', 'name email phoneNumber')
              .populate('event', 'title startDate endDate venue staffAssigned');
              
            logger.info('Event + userId lookup result:', { found: !!ticket });
          }
        }
      }
    }

    if (!ticket) {
      logger.error('No ticket found with the provided QR data');
      return next(new ErrorResponse('Ticket not found with this QR code', 404));
    }

    logger.info('Found ticket', { 
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber
    });

    // Get user from the ticket
    const user = ticket.purchasedBy;
    if (!user) {
      return next(new ErrorResponse('Ticket owner information not found', 404));
    }

    // Check event-related permissions
    const staffId = req.user._id;
    const isAdmin = req.user.role === 'admin';
    const event = ticket.event;
    const now = new Date();
    
    // Check if event exists
    if (!event) {
      return next(new ErrorResponse('Event information not found for this ticket', 404));
    }

    // Check if staff is assigned to this event or is admin
    const canVerify = isAdmin || 
      (event.staffAssigned && 
      event.staffAssigned.some(id => id.toString() === staffId.toString()));
                    
    // Check if event is currently active
    const isEventActive = event.startDate <= now && event.endDate >= now;
    
    // If specific event ID was requested, verify it matches
    if (eventId && event._id.toString() !== eventId) {
      return next(new ErrorResponse('This ticket is not for the selected event', 400));
    }
    
    // Format ticket for response
    const ticketData = {
      ticketId: ticket._id,
      ticketnumber: ticket.ticketNumber,
      eventId: event._id,
      eventTitle: event.title,
      eventVenue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      status: ticket.status,
      qrCode:ticket.qrCode,
      canVerify: canVerify,
      isEventActive: isEventActive,
      canBeMarkedAttended: canVerify && isEventActive && ticket.status === 'active'
    };

    // Create response with user and ticket information
    const response = {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber
      },
      tickets: [ticketData]
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error verifying ticket', { error: error.message, stack: error.stack });
    return next(new ErrorResponse('An error occurred while verifying the ticket', 500));
  }
});

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
    
    .populate('event', 'name startTime endTime location')
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

// @desc    Book ticket for a specific event show
// @route   POST /api/v1/tickets/book
// @access  Private
exports.bookTicket = asyncHandler(async (req, res, next) => {
  const { eventId, showId, headCount } = req.body;
  if (!eventId || !showId || !headCount || headCount < 1) {
    return next(new ErrorResponse('Event, show, and valid head count are required', 400));
  }

  // 1. Check entry pass
  const now = new Date();
  const entryPass = await EntryPass.findOne({ user: req.user._id, status: 'active', expiresAt: { $gt: now } });
  if (!entryPass || entryPass.headCount < headCount) {
    return next(new ErrorResponse('Not enough entry pass head count. Please purchase or increment your entry pass.', 400));
  }

  // 2. Check event and show
  const event = await Event.findById(eventId);
  if (!event) return next(new ErrorResponse('Event not found', 404));
  const show = event.shows.find(s => s.showId === showId);
  if (!show) return next(new ErrorResponse('Show not found', 404));

  // 3. Check event capacity and show seats
  if (event.capacity < show.seatsBooked + headCount) {
    return next(new ErrorResponse('Not enough seats available for this show', 400));
  }

  // 4. Create ticket
  // Generate QR code data (unique per ticket)
  const ticketData = `${eventId}|${showId}|${req.user._id}|${Date.now()}|${Math.random().toString(36).substr(2, 8)}`;
  const qrCode = await QRCode.toDataURL(ticketData);

  // Generate ticket number manually (should be auto-generated by pre-save hook, but adding here as backup)
  const timestamp = Date.now().toString();
  const crypto = require('crypto');
  const randomStr = crypto.randomBytes(3).toString('hex');
  const ticketNumber = `TIX-${timestamp.substring(timestamp.length - 6)}-${randomStr.toUpperCase()}`;

  const ticket = await Ticket.create({
    ticketNumber,
    purchasedBy: req.user._id,
    issuedBy: req.user._id,
    event: eventId,
    showId,
    headCount,
    totalAmount: event.price * headCount,
    paymentStatus: 'completed',
    status: 'active',
    qrCode,
  });

  // 5. Update entry pass and event show
  // entryPass.headCount -= headCount;
  // await entryPass.save();
  show.seatsBooked += headCount;
  await event.save();

  // 6. Schedule notification (stub: log for now)
  const showDateTime = new Date(show.date);
  const [h, m] = show.startTime.split(':').map(Number);
  showDateTime.setHours(h, m, 0, 0);
  const notifyAt = new Date(showDateTime.getTime() - 30 * 60 * 1000);
  console.log(`Notification for user ${req.user._id} scheduled at ${notifyAt.toISOString()} for ticket ${ticket._id}`);

  res.status(201).json({ success: true, ticket });
});

// @desc    Verify ticket by data URL QR code
// @route   POST /api/v1/tickets/verify-data-url
// @access  Private (Staff/Admin)
exports.verifyTicketByDataUrl = asyncHandler(async (req, res, next) => {
  const { qrData, eventId } = req.body;

  if (!qrData || typeof qrData !== 'string' || !qrData.startsWith('data:image')) {
    return next(new ErrorResponse('Valid QR code data URL is required', 400));
  }

  logger.info('Looking for ticket with exact QR code data URL');

  // First, try to find the ticket with the exact QR code
  const ticket = await Ticket.findOne({ qrCode: qrData })
    .populate('purchasedBy', 'name email phoneNumber')
    .populate('event', 'title startDate endDate venue staffAssigned');

  if (!ticket) {
    logger.error('No ticket found with the provided QR code data URL');
    return next(new ErrorResponse('Ticket not found with this QR code', 404));
  }

  logger.info('Found ticket', { 
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber
  });

  // Get the user
  const user = ticket.purchasedBy;
  if (!user) {
    return next(new ErrorResponse('Ticket owner information not found', 404));
  }

  // Staff member can only verify events they are assigned to (unless they are admin)
  const staffId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  const event = ticket.event;
  const now = new Date();
  
  // Check if event exists
  if (!event) {
    return next(new ErrorResponse('Event information not found for this ticket', 404));
  }

  // Check if staff is assigned to this event or is admin
  const canVerify = isAdmin || 
    (event.staffAssigned && 
     event.staffAssigned.some(id => id.toString() === staffId.toString()));
                     
  // Check if event is currently active (between start and end dates)
  const isEventActive = event.startDate <= now && event.endDate >= now;
  
  // Format ticket for response
  const ticketData = {
    ticketId: ticket._id,
    eventId: event._id,
    eventTitle: event.title,
    eventVenue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    status: ticket.status,
    canVerify: canVerify,
    isEventActive: isEventActive,
    canBeMarkedAttended: canVerify && isEventActive && ticket.status === 'active'
  };

  // Create response with user and ticket information
  const response = {
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber
    },
    tickets: [ticketData]
  };

  res.status(200).json(response);
});

// @desc    Mark ticket as attended
// @route   POST /api/v1/tickets/mark-attended
// @access  Private (Staff/Admin only)
exports.markEventAttended = asyncHandler(async (req, res, next) => {
  const { ticketId, eventId } = req.body;
  
  if (!ticketId || !eventId) {
    return next(new ErrorResponse('Ticket ID and Event ID are required', 400));
  }
  
  // Check if user is staff or admin
  if (!req.user || (req.user.role !== 'staff' && req.user.role !== 'admin')) {
    return next(new ErrorResponse('Only staff or admin can mark tickets as attended', 403));
  }
  
  // Find the ticket
  const ticket = await Ticket.findById(ticketId);
  
  if (!ticket) {
    return next(new ErrorResponse('Ticket not found', 404));
  }
  
  // Verify that this ticket belongs to the specified event
  if (ticket.event.toString() !== eventId) {
    return next(new ErrorResponse('This ticket is not for the specified event', 400));
  }
  
  // Set status to attended
  ticket.status = 'used';
  ticket.verifiedAt = new Date();
  ticket.verifiedBy = req.user._id;
  
  await ticket.save();
  
  logger.info('Ticket marked as used', {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    eventId: eventId,
    markedBy: req.user.id
  });
  
  res.status(200).json({
    success: true,
    data: ticket,
    message: 'Ticket successfully marked as used'
  });
});

