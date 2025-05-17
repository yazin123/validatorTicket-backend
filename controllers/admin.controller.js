const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/user.model');
const Event = require('../models/event.model');
const Ticket = require('../models/ticket.model');
const Payment = require('../models/payment.model');
const {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  subDays, subMonths, format, parseISO, eachDayOfInterval
} = require('date-fns');
const Settings = require('../models/settings.model');
const multer = require('multer');
const path = require('path');

// Multer config for event images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/events'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

exports.uploadEventMedia = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]);

const userStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/users'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const userUpload = multer({ storage: userStorage });
exports.uploadUserImage = userUpload.single('image');

// @route  api/v1/admin/


exports.getStats = async (req, res) => {
  try {
    const {
      timeRange = 'month',
      startDate: customStartDate,
      endDate: customEndDate,
      topEventsPage = 1,
      topEventsLimit = 5,
      eventPerformancePage = 1,
      eventPerformanceLimit = 10
    } = req.query;

    const now = new Date();
    let startDate, endDate;

    // Handle custom date range if provided
    if (customStartDate && customEndDate) {
      startDate = startOfDay(parseISO(customStartDate));
      endDate = endOfDay(parseISO(customEndDate));
    } else {
      // Default time ranges
      switch (timeRange) {
        case 'day':
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case 'week':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case 'year':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        case 'last7days':
          startDate = startOfDay(subDays(now, 6));
          endDate = endOfDay(now);
          break;
        case 'last30days':
          startDate = startOfDay(subDays(now, 29));
          endDate = endOfDay(now);
          break;
        case 'last3months':
          startDate = startOfDay(subMonths(now, 3));
          endDate = endOfDay(now);
          break;
        case 'last6months':
          startDate = startOfDay(subMonths(now, 6));
          endDate = endOfDay(now);
          break;
        default: // month
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }
    }

    const [
      totalUsers,
      newUsers,
      totalEvents,
      upcomingEvents,
      totalTickets,
      activeTickets,
      totalRevenue,
      periodRevenue,
      ticketSales,
      revenue,
      eventDistribution,
      topEvents,
      userRegistrations,
      paymentMethodStats,
      ticketStatusDistribution,
      eventCategoryDistribution,
      recentTickets,
      attendanceStats
    ] = await Promise.all([
      // User statistics
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),

      // Event statistics  
      Event.countDocuments(),
      Event.countDocuments({ startDate: { $gt: now }, status: 'published' }),

      // Ticket statistics
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'valid' }),

      // Revenue statistics
      Ticket.aggregate([
        { $match: { status: { $in: ['valid', 'used'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),

      Ticket.aggregate([
        {
          $match: {
            status: { $in: ['valid', 'used'] },
            purchaseDate: { $gte: startDate, $lte: endDate }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),

      // Ticket sales over time
      Ticket.aggregate([
        {
          $match: {
            purchaseDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Revenue over time
      Ticket.aggregate([
        {
          $match: {
            purchaseDate: { $gte: startDate, $lte: endDate },
            status: { $in: ['valid', 'used'] }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
            amount: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Top events by revenue (paginated)
      Event.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'events.event',
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
                in: { $add: ['$$value', '$$this.totalAmount'] }
              }
            }
          }
        },
        { $sort: { revenue: -1 } },
        { $skip: (parseInt(topEventsPage) - 1) * parseInt(topEventsLimit) },
        { $limit: parseInt(topEventsLimit) }
      ]),

      // Event performance (paginated)
      Event.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'events.event',
            as: 'tickets'
          }
        },
        {
          $project: {
            title: 1,
            ticketsSold: { $size: '$tickets' },
            capacity: 1,
            percentageSold: {
              $multiply: [
                { $divide: [{ $size: '$tickets' }, { $max: ['$capacity', 1] }] },
                100
              ]
            }
          }
        },
        { $sort: { title: 1 } },
        { $skip: (parseInt(eventPerformancePage) - 1) * parseInt(eventPerformanceLimit) },
        { $limit: parseInt(eventPerformanceLimit) }
      ]),

      // User registrations over time
      User.aggregate([
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

      // Payment method distribution
      Payment.aggregate([
        {
          $match: {
            status: 'completed',
            transactionDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$amount' }
          }
        }
      ]),

      // Ticket status distribution
      Ticket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Event category distribution
      Event.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: '$categoryInfo.name',
            count: { $sum: 1 }
          }
        }
      ]),

      // Recent tickets
      Ticket.find()
        .populate({
          path: 'events.event',
          select: 'title'
        })
        .populate({
          path: 'purchasedBy',
          select: 'name email'
        })
        .sort('-purchaseDate')
        .limit(10),

      // Attendance statistics - new query
      Ticket.aggregate([
        {
          $unwind: '$events'
        },
        {
          $group: {
            _id: {
              eventId: '$events.event',
              status: '$events.status'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.eventId',
            statuses: {
              $push: {
                status: '$_id.status',
                count: '$count'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'eventDetails'
          }
        },
        {
          $unwind: '$eventDetails'
        },
        {
          $project: {
            eventId: '$_id',
            eventTitle: '$eventDetails.title',
            statuses: 1,
            registeredCount: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$statuses',
                    as: 'status',
                    cond: { $eq: ['$$status.status', 'registered'] }
                  }
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.count'] }
              }
            },
            attendedCount: {
              $reduce: {
                input: {
                  $filter: {
                    input: '$statuses',
                    as: 'status',
                    cond: { $eq: ['$$status.status', 'attended'] }
                  }
                },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.count'] }
              }
            }
          }
        },
        {
          $sort: { 'eventTitle': 1 }
        }
      ])
    ]);

    // Add pagination metadata to response
    const topEventsTotal = await Event.countDocuments();
    const eventPerformanceTotal = await Event.countDocuments();

    res.json({
      timeRange,
      dateRange: {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      },
      users: {
        total: totalUsers,
        new: newUsers,
        registrationTrend: userRegistrations.map(item => ({
          date: item._id,
          count: item.count
        }))
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
        categoryDistribution: eventCategoryDistribution.map(item => ({
          category: item._id || 'Uncategorized',
          count: item.count
        }))
      },
      tickets: {
        total: totalTickets,
        active: activeTickets,
        statusDistribution: ticketStatusDistribution.map(item => ({
          status: item._id,
          count: item.count
        }))
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        period: periodRevenue[0]?.total || 0,
        trend: revenue.map(rev => ({
          date: rev._id,
          amount: rev.amount
        }))
      },
      ticketSales: ticketSales.map(sale => ({
        date: sale._id,
        count: sale.count
      })),
      eventPerformance: eventDistribution.map(event => ({
        title: event.title,
        ticketsSold: event.ticketsSold || 0,
        capacity: event.capacity || 0,
        percentageSold: event.percentageSold ? parseFloat(event.percentageSold.toFixed(2)) : 0
      })),
      topEvents: topEvents.map(event => ({
        title: event.title,
        ticketsSold: event.ticketsSold || 0,
        revenue: event.revenue || 0
      })),
      topEventsPagination: {
        total: topEventsTotal,
        page: parseInt(topEventsPage),
        pages: Math.ceil(topEventsTotal / parseInt(topEventsLimit)),
        limit: parseInt(topEventsLimit)
      },
      paymentMethods: paymentMethodStats.map(method => ({
        method: method._id || 'other',
        count: method.count,
        amount: method.total
      })),
      recentTickets: recentTickets.map(ticket => ({
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        user: ticket.purchasedBy ? `${ticket.purchasedBy.name} (${ticket.purchasedBy.email})` : 'Unknown User',
        events: ticket.events,
        status: ticket.status,
        amount: ticket.totalAmount,
        purchaseDate: ticket.purchaseDate
      })),
      attendanceStats: attendanceStats.map(stat => ({
        eventId: stat.eventId,
        eventTitle: stat.eventTitle,
        registeredCount: stat.registeredCount || 0,
        attendedCount: stat.attendedCount || 0,
        attendanceRate: stat.registeredCount 
          ? Math.round((stat.attendedCount / stat.registeredCount) * 100) 
          : 0
      })),
      eventPerformancePagination: {
        total: eventPerformanceTotal,
        page: parseInt(eventPerformancePage),
        pages: Math.ceil(eventPerformanceTotal / parseInt(eventPerformanceLimit)),
        limit: parseInt(eventPerformanceLimit)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
};


exports.getUsers = async (req, res) => {
  try {
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      User.countDocuments(),
      User.find().select('-password').skip(skip).limit(limit)
    ]);

    res.json({
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
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
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [total, tickets] = await Promise.all([
      Ticket.countDocuments({ user: req.params.userId }),
      Ticket.find({ user: req.params.userId })
        .populate('event')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      tickets,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({ message: 'Error fetching user tickets' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [total, events] = await Promise.all([
      Event.countDocuments(),
      Event.find().sort('-date').skip(skip).limit(limit)
    ]);

    res.json({
      events,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching events' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    // Parse fields from req.body
    const {
      title, description, startDate, endDate, venue, price, capacity, status, tags, features, terms, staffAssigned
    } = req.body;
    if (!title || !description || !startDate || !endDate || !venue || !price || !capacity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    // Handle file uploads
    let image = undefined;
    let gallery = [];
    if (req.files && req.files.image && req.files.image[0]) {
      image = '/uploads/events/' + req.files.image[0].filename;
    }
    if (req.files && req.files.gallery) {
      gallery = req.files.gallery.map(f => '/uploads/events/' + f.filename);
    }
    // Parse tags/features as arrays
    const tagsArr = typeof tags === 'string' ? tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    const featuresArr = typeof features === 'string' ? features.split(',').map(s => s.trim()).filter(Boolean) : [];
    // Parse staffAssigned as array
    let staffArr = [];
    if (staffAssigned) {
      if (Array.isArray(staffAssigned)) staffArr = staffAssigned;
      else staffArr = [staffAssigned];
    }
    // Create event
    const event = await Event.create({
      title,
      description,
      startDate,
      endDate,
      venue,
      price,
      capacity,
      status: status || 'draft',
      image,
      gallery,
      tags: tagsArr,
      features: featuresArr,
      terms,
      staffAssigned: staffArr,
      organizer: req.user._id
    });
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
    // Pagination params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [total, tickets] = await Promise.all([
      Ticket.countDocuments({ event: req.params.eventId }),
      Ticket.find({ event: req.params.eventId })
        .populate('user', 'name email')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      tickets,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
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

// @desc    Get attendance statistics for events
// @route   GET /api/v1/admin/analytics/attendance
// @access  Private (Admin)
exports.getAttendanceAnalytics = asyncHandler(async (req, res) => {
  const {
    timeRange = 'month',
    startDate: customStartDate,
    endDate: customEndDate
  } = req.query;

  const now = new Date();
  let startDate, endDate;

  // Handle custom date range if provided
  if (customStartDate && customEndDate) {
    startDate = startOfDay(parseISO(customStartDate));
    endDate = endOfDay(parseISO(customEndDate));
  } else {
    // Default time ranges
    switch (timeRange) {
      case 'week':
        startDate = startOfWeek(now);
        endDate = now;
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = now;
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = now;
        break;
      case 'last7days':
        startDate = subDays(now, 6);
        endDate = now;
        break;
      case 'last30days':
        startDate = subDays(now, 29);
        endDate = now;
        break;
      case 'last3months':
        startDate = subMonths(now, 3);
        endDate = now;
        break;
      default:
        startDate = startOfMonth(now);
        endDate = now;
    }
  }

  try {
    // Get events in date range
    const events = await Event.find({
      startDate: { $gte: startDate, $lte: endDate }
    }).select('_id title venue startDate endDate capacity');

    // Get tickets with events in the date range
    const tickets = await Ticket.find({
      'events.event': { $in: events.map(e => e._id) },
      'paymentStatus': 'completed'
    }).populate('events.event');

    // Process attendance data for each event
    const eventAttendanceData = events.map(event => {
      const relevantTickets = tickets.filter(ticket => 
        ticket.events.some(e => e.event._id.toString() === event._id.toString())
      );

      const registeredCount = relevantTickets.length;
      const attendedCount = relevantTickets.filter(ticket => 
        ticket.events.some(e => 
          e.event._id.toString() === event._id.toString() && 
          e.status === 'attended'
        )
      ).length;

      const attendanceRate = registeredCount > 0 
        ? Math.round((attendedCount / registeredCount) * 100) 
        : 0;

      return {
        eventId: event._id,
        title: event.title,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        capacity: event.capacity,
        registeredCount,
        attendedCount,
        attendanceRate
      };
    });

    // Get daily attendance data
    const dailyAttendance = [];
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    for (const date of dateRange) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const dayTickets = tickets.filter(ticket => 
        ticket.events.some(e => 
          e.verifiedAt && 
          format(new Date(e.verifiedAt), 'yyyy-MM-dd') === formattedDate
        )
      );
      
      dailyAttendance.push({
        date: formattedDate,
        count: dayTickets.length
      });
    }

    res.status(200).json({
      success: true,
      timeRange,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      events: eventAttendanceData,
      dailyAttendance
    });
  } catch (error) {
    console.error('Error getting attendance analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting attendance analytics'
    });
  }
});

// Get detailed revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const {
      startDate: startDateStr,
      endDate: endDateStr,
      groupBy = 'day'
    } = req.query;

    const startDate = startDateStr ? new Date(startDateStr) : startOfMonth(new Date());
    const endDate = endDateStr ? new Date(endDateStr) : endOfDay(new Date());

    let groupFormat;
    let projectFormat;

    switch (groupBy) {
      case 'hour':
        groupFormat = '%Y-%m-%d-%H';
        projectFormat = {
          year: { $year: '$purchaseDate' },
          month: { $month: '$purchaseDate' },
          day: { $dayOfMonth: '$purchaseDate' },
          hour: { $hour: '$purchaseDate' }
        };
        break;
      case 'week':
        groupFormat = '%G-%V'; // ISO year and week
        projectFormat = {
          year: { $year: '$purchaseDate' },
          week: { $week: '$purchaseDate' }
        };
        break;
      case 'month':
        groupFormat = '%Y-%m';
        projectFormat = {
          year: { $year: '$purchaseDate' },
          month: { $month: '$purchaseDate' }
        };
        break;
      case 'year':
        groupFormat = '%Y';
        projectFormat = {
          year: { $year: '$purchaseDate' }
        };
        break;
      default: // day
        groupFormat = '%Y-%m-%d';
        projectFormat = {
          year: { $year: '$purchaseDate' },
          month: { $month: '$purchaseDate' },
          day: { $dayOfMonth: '$purchaseDate' }
        };
    }

    const data = await Ticket.aggregate([
      {
        $match: {
          purchaseDate: { $gte: startDate, $lte: endDate },
          paymentStatus: 'completed'
        }
      },
      {
        $project: {
          ...projectFormat,
          amount: '$totalAmount',
          formattedDate: { $dateToString: { format: groupFormat, date: '$purchaseDate' } }
        }
      },
      {
        $group: {
          _id: '$formattedDate',
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get comparison with previous period
    const periodLength = endDate - startDate;
    const previousPeriodStart = new Date(startDate.getTime() - periodLength);
    const previousPeriodEnd = new Date(endDate.getTime() - periodLength);

    const previousPeriodData = await Ticket.aggregate([
      {
        $match: {
          purchaseDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate current period totals
    const currentPeriodTotal = data.reduce((acc, item) => acc + item.totalRevenue, 0);
    const currentPeriodCount = data.reduce((acc, item) => acc + item.count, 0);

    const previousPeriodTotal = previousPeriodData[0]?.totalRevenue || 0;
    const previousPeriodCount = previousPeriodData[0]?.count || 0;

    const revenueChange = previousPeriodTotal === 0
      ? 100
      : ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal * 100);

    const countChange = previousPeriodCount === 0
      ? 100
      : ((currentPeriodCount - previousPeriodCount) / previousPeriodCount * 100);

    res.json({
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      data: data.map(item => ({
        period: item._id,
        revenue: item.totalRevenue,
        count: item.count
      })),
      summary: {
        currentPeriod: {
          revenue: currentPeriodTotal,
          count: currentPeriodCount
        },
        previousPeriod: {
          revenue: previousPeriodTotal,
          count: previousPeriodCount
        },
        changes: {
          revenue: revenueChange ? parseFloat(revenueChange.toFixed(2)) : 0,
          count: countChange ? parseFloat(countChange.toFixed(2)) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ message: 'Error fetching revenue analytics', error: error.message });
  }
};

// Get attendance statistics
exports.getAttendanceStats = async (req, res) => {
  try {
    const { eventId, startDate: startDateStr, endDate: endDateStr } = req.query;

    const startDate = startDateStr ? new Date(startDateStr) : startOfMonth(new Date());
    const endDate = endDateStr ? new Date(endDateStr) : endOfDay(new Date());

    const matchCriteria = {
      'events.verified': true,
      'events.verifiedAt': { $gte: startDate, $lte: endDate }
    };

    if (eventId) {
      matchCriteria['events.event'] = mongoose.Types.ObjectId(eventId);
    }

    const attendanceData = await Ticket.aggregate([
      { $unwind: '$events' },
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'events',
          localField: 'events.event',
          foreignField: '_id',
          as: 'eventData'
        }
      },
      { $unwind: '$eventData' },
      {
        $group: {
          _id: {
            event: '$events.event',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$events.verifiedAt' } }
          },
          eventTitle: { $first: '$eventData.title' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Group by event
    const eventSummary = [];
    const eventMap = new Map();

    attendanceData.forEach(item => {
      const eventId = item._id.event.toString();
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          eventId,
          title: item.eventTitle,
          totalAttendance: 0,
          dailyAttendance: []
        });
      }

      const eventRecord = eventMap.get(eventId);
      eventRecord.totalAttendance += item.count;
      eventRecord.dailyAttendance.push({
        date: item._id.date,
        count: item.count
      });
    });

    eventMap.forEach(event => {
      eventSummary.push(event);
    });

    res.json({
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      events: eventSummary,
      dailyAttendance: attendanceData.map(item => ({
        date: item._id.date,
        eventId: item._id.event,
        eventTitle: item.eventTitle,
        count: item.count
      }))
    });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({ message: 'Error fetching attendance statistics', error: error.message });
  }
};

// Get user registration analytics
exports.getUserRegistrationStats = async (req, res) => {
  try {
    const { startDate: startDateStr, endDate: endDateStr, groupBy = 'day' } = req.query;

    const startDate = startDateStr ? new Date(startDateStr) : startOfMonth(new Date());
    const endDate = endDateStr ? new Date(endDateStr) : endOfDay(new Date());

    let groupFormat;

    switch (groupBy) {
      case 'week':
        groupFormat = '%G-%V'; // ISO year and week
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
      case 'year':
        groupFormat = '%Y';
        break;
      default: // day
        groupFormat = '%Y-%m-%d';
    }

    const registrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get role distribution
    const roleDistribution = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate total and comparison with previous period
    const periodLength = endDate - startDate;
    const previousPeriodStart = new Date(startDate.getTime() - periodLength);
    const previousPeriodEnd = new Date(endDate.getTime() - periodLength);

    const [currentTotal, previousTotal] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      User.countDocuments({ createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd } })
    ]);

    const percentChange = previousTotal === 0
      ? 100
      : ((currentTotal - previousTotal) / previousTotal * 100);

    res.json({
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      registrations: registrations.map(item => ({
        period: item._id,
        count: item.count
      })),
      roleDistribution: roleDistribution.map(item => ({
        role: item._id,
        count: item.count
      })),
      summary: {
        currentPeriod: currentTotal,
        previousPeriod: previousTotal,
        change: percentChange ? parseFloat(percentChange.toFixed(2)) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching user registration stats:', error);
    res.status(500).json({ message: 'Error fetching user statistics', error: error.message });
  }
};

// Get event performance metrics
exports.getEventPerformanceStats = async (req, res) => {
  try {
    const { status, category, sortBy = 'revenue', limit = 10 } = req.query;

    const matchCriteria = {};

    if (status) {
      matchCriteria.status = status;
    }

    if (category) {
      matchCriteria.category = mongoose.Types.ObjectId(category);
    }

    let sortCriteria = {};
    switch (sortBy) {
      case 'ticketsSold':
        sortCriteria = { 'metrics.ticketsSold': -1 };
        break;
      case 'percentageSold':
        sortCriteria = { 'metrics.percentageSold': -1 };
        break;
      default: // revenue
        sortCriteria = { 'metrics.revenue': -1 };
    }

    const eventStats = await Event.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'tickets',
          localField: '_id',
          foreignField: 'events.event',
          as: 'tickets'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $addFields: {
          categoryName: {
            $ifNull: [{ $arrayElemAt: ['$categoryInfo.name', 0] }, 'Uncategorized']
          }
        }
      },
      {
        $project: {
          title: 1,
          venue: 1,
          startDate: 1,
          endDate: 1,
          status: 1,
          categoryName: 1,
          capacity: 1,
          price: 1,
          metrics: {
            ticketsSold: { $size: '$tickets' },
            revenue: {
              $reduce: {
                input: '$tickets',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.totalAmount'] }
              }
            },
            percentageSold: {
              $multiply: [
                { $divide: [{ $size: '$tickets' }, { $max: ['$capacity', 1] }] },
                100
              ]
            }
          }
        }
      },
      { $sort: sortCriteria },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      events: eventStats.map(event => ({
        id: event._id,
        title: event.title,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        category: event.categoryName,
        capacity: event.capacity,
        price: event.price,
        ticketsSold: event.metrics.ticketsSold,
        revenue: event.metrics.revenue,
        percentageSold: event.metrics && event.metrics.percentageSold ? parseFloat(event.metrics.percentageSold.toFixed(2)) : 0
      }))
    });
  } catch (error) {
    console.error('Error fetching event performance stats:', error);
    res.status(500).json({ message: 'Error fetching event statistics', error: error.message });
  }
};

// Get geographic distribution of ticket sales
exports.getGeographicStats = async (req, res) => {
  try {
    const { startDate: startDateStr, endDate: endDateStr } = req.query;

    const startDate = startDateStr ? new Date(startDateStr) : startOfYear(new Date());
    const endDate = endDateStr ? new Date(endDateStr) : endOfDay(new Date());

    // This assumes tickets have user reference and users have address information
    const geoStats = await Ticket.aggregate([
      {
        $match: {
          purchaseDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'purchasedBy',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id: {
            country: '$userInfo.address.country',
            state: '$userInfo.address.state'
          },
          ticketCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { ticketCount: -1 } }
    ]);

    res.json({
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      geographicData: geoStats.map(item => ({
        location: {
          country: item._id.country || 'Unknown',
          state: item._id.state || 'Unknown'
        },
        ticketCount: item.ticketCount,
        revenue: item.revenue
      }))
    });
  } catch (error) {
    console.error('Error fetching geographic stats:', error);
    res.status(500).json({ message: 'Error fetching geographic statistics', error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    let profileImage = 'default.jpg';
    if (req.file) {
      profileImage = '/uploads/users/' + req.file.filename;
    }
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      status: status || 'active',
      profileImage
    });
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

