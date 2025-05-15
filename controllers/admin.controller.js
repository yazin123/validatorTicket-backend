const User = require('../models/user.model');
const Ticket = require('../models/ticket.model');
const Event = require('../models/event.model');
const Exhibition = require('../models/exhibition.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } = require('date-fns');
const Settings = require('../models/settings.model');

// @desc    Get dashboard statistics
// @route   GET /api/v1/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    const now = new Date();
    let startDate, endDate;

    switch (timeRange) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default: // month
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    const [
      totalTickets,
      activeTickets,
      upcomingEvents,
      totalRevenue,
      ticketSales,
      revenue,
      eventDistribution,
      topEvents
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'valid' }),
      Event.countDocuments({ date: { $gt: now }, status: 'published' }),
      Ticket.aggregate([
        { $match: { status: 'valid' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]),
      Ticket.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Ticket.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'valid'
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$price' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Event.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'event',
            as: 'tickets'
          }
        },
        {
          $project: {
            title: 1,
            ticketsSold: { $size: '$tickets' }
          }
        }
      ]),
      Event.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'event',
            as: 'tickets'
          }
        },
        {
          $project: {
            title: 1,
            ticketsSold: { $size: '$tickets' },
            revenue: {
              $reduce: {
                input: '$tickets',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.price'] }
              }
            }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ])
    ]);

    res.json({
      totalTickets,
      activeTickets,
      upcomingEvents,
      totalRevenue: totalRevenue[0]?.total || 0,
      ticketSales: ticketSales.map(sale => ({
        date: sale._id,
        count: sale.count
      })),
      revenue: revenue.map(rev => ({
        date: rev._id,
        amount: rev.amount
      })),
      eventDistribution: eventDistribution.map(event => ({
        title: event.title,
        ticketsSold: event.ticketsSold
      })),
      topEvents: topEvents.map(event => ({
        title: event.title,
        ticketsSold: event.ticketsSold,
        revenue: event.revenue
      }))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Error fetching user details' });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin)
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Error updating user role' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Error updating user status' });
  }
};

exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.params.userId })
      .populate('event')
      .sort('-createdAt');
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({ message: 'Error fetching user tickets' });
  }
};

// @desc    Get all exhibitions
// @route   GET /api/admin/exhibitions
// @access  Private (Admin)
exports.getAllExhibitions = async (req, res, next) => {
  try {
    const exhibitions = await Exhibition.find()
      .sort('-startDate');

    res.status(200).json({
      success: true,
      data: exhibitions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create exhibition
// @route   POST /api/admin/exhibitions
// @access  Private (Admin)
exports.createExhibition = async (req, res, next) => {
  try {
    const exhibition = await Exhibition.create(req.body);

    res.status(201).json({
      success: true,
      data: exhibition,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update exhibition
// @route   PUT /api/admin/exhibitions/:id
// @access  Private (Admin)
exports.updateExhibition = async (req, res, next) => {
  try {
    const exhibition = await Exhibition.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!exhibition) {
      return next(new ErrorResponse('Exhibition not found', 404));
    }

    res.status(200).json({
      success: true,
      data: exhibition,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete exhibition
// @route   DELETE /api/admin/exhibitions/:id
// @access  Private (Admin)
exports.deleteExhibition = async (req, res, next) => {
  try {
    const exhibition = await Exhibition.findById(req.params.id);

    if (!exhibition) {
      return next(new ErrorResponse('Exhibition not found', 404));
    }

    // Check if exhibition has any events
    const hasEvents = await Event.exists({ exhibition: exhibition._id });

    if (hasEvents) {
      return next(new ErrorResponse('Cannot delete exhibition with existing events', 400));
    }

    await exhibition.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// Event management
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort('-date');
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching events' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Error creating event' });
  }
};

exports.getEventDetails = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).json({ message: 'Error fetching event details' });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      req.body,
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Error updating event' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Error deleting event' });
  }
};

exports.updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      { status },
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ message: 'Error updating event status' });
  }
};

exports.getEventTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ event: req.params.eventId })
      .populate('user', 'name email')
      .sort('-createdAt');
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching event tickets:', error);
    res.status(500).json({ message: 'Error fetching event tickets' });
  }
};

// Settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        siteName: 'Event Management System',
        contactEmail: 'admin@example.com',
        description: 'Event management and ticket booking system',
        enableQRScanning: true,
        requireEmailVerification: true,
        allowTicketTransfers: true,
        enableEmailNotifications: true,
        enableSMSNotifications: false
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findOneAndUpdate(
        {},
        req.body,
        { new: true }
      );
    }
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
}; 