// controllers/event.controller.js
const Event = require('../models/event.model');
const { ErrorResponse } = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, createPaginationMetadata } = require('../utils/helpers');

// @desc    Get all events
// @route   GET /api/v1/events
// @route   GET /api/v1/events
// @access  Public
exports.getEvents = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);

  let query;

  query = Event.find().populate('category', 'title');


  // Add filters
  if (req.query.status) {
    query = query.find({ status: req.query.status });
  }

  // Get total count for pagination
  const total = await Event.countDocuments(query);

  // Add pagination
  const events = await query
    .skip(skip)
    .limit(limit)
    .sort('startTime');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: events,
  });
});

// @desc    Get single event
// @route   GET /api/v1/events/:id
// @access  Public
exports.getEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id)
    .populate('category', 'title')
    .populate('ratings', 'rating comment user');

  if (!event) {
    return next(new ErrorResponse('Event not found', 404));
  }

  res.status(200).json({
    success: true,
    data: event,
  });
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

