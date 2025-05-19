// controllers/event.controller.js
const Event = require('../models/event.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, createPaginationMetadata } = require('../utils/helpers');

// @desc    List events with show details and filtering
// @route   GET /api/v1/events
// @access  Public
exports.getEvents = asyncHandler(async (req, res, next) => {
  const { category, date, minPrice, maxPrice, status } = req.query;
  const filter = {};
  if (category) filter.tags = category;
  if (status) filter.status = status;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  // Only published events by default
  if (!status) filter.status = 'published';

  // Date filter: find events with at least one show on/after the given date
  if (date) {
    filter['shows.date'] = { $gte: new Date(date) };
  }

  const events = await Event.find(filter).select('-__v').sort({ startDate: 1 });
  res.status(200).json({ success: true, events });
});

// @desc    Get event details with all shows
// @route   GET /api/v1/events/:id
// @access  Public
exports.getEventDetails = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id).select('-__v');
  if (!event) return next(new ErrorResponse('Event not found', 404));
  res.status(200).json({ success: true, event });
});

// @desc    Create new event
// @route   POST /api/v1/events
// @access  Private/Admin
exports.createEvent = asyncHandler(async (req, res, next) => {

  const event = await Event.create(req.body);

  res.status(201).json({
    success: true,
    data: event
  });
});

// @desc    Update event
// @route   PUT /api/v1/events/:id
// @access  Private/Admin
exports.updateEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);

  if (!event) {
    return next(new ErrorResponse('Event not found', 404));
  }

  event = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: event
  });
});

// @desc    Delete event
// @route   DELETE /api/v1/events/:id
// @access  Private/Admin
exports.deleteEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new ErrorResponse('Event not found', 404));
  }

  await event.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Add a show to an event
// @route   POST /api/v1/events/:id/shows
// @access  Private/Admin
exports.addShow = asyncHandler(async (req, res, next) => {
  const { date, startTime, endTime } = req.body;
  if (!date || !startTime || !endTime) {
    return next(new ErrorResponse('Date, startTime, and endTime are required', 400));
  }
  const event = await Event.findById(req.params.id);
  if (!event) return next(new ErrorResponse('Event not found', 404));
  // Generate unique showId
  const showId = `SHOW-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  event.shows.push({ showId, date, startTime, endTime });
  await event.save();
  res.status(201).json({ success: true, shows: event.shows });
});

// @desc    Update a show in an event
// @route   PUT /api/v1/events/:id/shows/:showId
// @access  Private/Admin
exports.updateShow = asyncHandler(async (req, res, next) => {
  const { date, startTime, endTime } = req.body;
  const event = await Event.findById(req.params.id);
  if (!event) return next(new ErrorResponse('Event not found', 404));
  const show = event.shows.find(s => s.showId === req.params.showId);
  if (!show) return next(new ErrorResponse('Show not found', 404));
  if (date) show.date = date;
  if (startTime) show.startTime = startTime;
  if (endTime) show.endTime = endTime;
  await event.save();
  res.status(200).json({ success: true, show });
});

// @desc    Delete a show from an event
// @route   DELETE /api/v1/events/:id/shows/:showId
// @access  Private/Admin
exports.deleteShow = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) return next(new ErrorResponse('Event not found', 404));
  const showIndex = event.shows.findIndex(s => s.showId === req.params.showId);
  if (showIndex === -1) return next(new ErrorResponse('Show not found', 404));
  event.shows.splice(showIndex, 1);
  await event.save();
  res.status(200).json({ success: true, shows: event.shows });
});

exports.getEvent = exports.getEventDetails;

