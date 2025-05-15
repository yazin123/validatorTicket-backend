// controllers/rating.controller.js
const Rating = require('../models/rating.model');
const Event = require('../models/event.model');
const Ticket = require('../models/ticket.model');
const User = require('../models/user.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, createPaginationMetadata } = require('../utils/helpers');

// @desc    Get all ratings
// @route   GET /api/v1/ratings
// @access  Private/Admin
exports.getRatings = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  const filter = {};
  
  // Filter by event if provided
  if (req.query.event) {
    filter.event = req.query.event;
  }
  
  // Filter by user if provided
  if (req.query.user) {
    filter.user = req.query.user;
  }
  
  // Filter by minimum rating if provided
  if (req.query.minRating) {
    filter.rating = { $gte: parseInt(req.query.minRating, 10) };
  }
  
  const total = await Rating.countDocuments(filter);
  const ratings = await Rating.find(filter)
    .populate('user', 'name')
    .populate('event', 'name')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: ratings,
  });
});

// @desc    Get ratings for specific event
// @route   GET /api/v1/events/:eventId/ratings
// @access  Public
exports.getEventRatings = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  const event = await Event.findById(req.params.eventId);
  
  if (!event) {
    return next(new ErrorResponse(`Event not found with id of ${req.params.eventId}`, 404));
  }
  
  const total = await Rating.countDocuments({ event: req.params.eventId });
  const ratings = await Rating.find({ event: req.params.eventId })
    .populate('user', 'name')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: ratings,
  });
});

// @desc    Add rating to event
// @route   POST /api/v1/events/:eventId/ratings
// @access  Private
exports.addRating = asyncHandler(async (req, res, next) => {
  // Check if event exists
  const event = await Event.findById(req.params.eventId);
  
  if (!event) {
    return next(new ErrorResponse(`Event not found with id of ${req.params.eventId}`, 404));
  }
  
  // Verify that user has attended the event
  const userTickets = await Ticket.find({ 
    purchasedBy: req.user.id,
    'events.event': req.params.eventId,
    'events.verified': true,
    status: { $in: ['active', 'used'] }
  });
  
  if (userTickets.length === 0 && req.user.role !== 'admin') {
    return next(new ErrorResponse('You can only rate events you have attended', 403));
  }
  
  // Check if user has already rated this event
  const existingRating = await Rating.findOne({
    user: req.user.id,
    event: req.params.eventId
  });
  
  if (existingRating) {
    return next(new ErrorResponse('You have already rated this event', 400));
  }
  
  // Create rating
  const rating = await Rating.create({
    rating: req.body.rating,
    comment: req.body.comment,
    user: req.user.id,
    event: req.params.eventId
  });
  
  // Add rating to event
  await Event.findByIdAndUpdate(req.params.eventId, {
    $push: { ratings: rating._id }
  });
  
  // Add rating to user's event ratings
  await User.findByIdAndUpdate(req.user.id, {
    $push: { eventRatings: rating._id }
  });
  
  // Update event average rating
  const allRatings = await Rating.find({ event: req.params.eventId });
  const averageRating = allRatings.reduce((acc, item) => acc + item.rating, 0) / allRatings.length;
  
  await Event.findByIdAndUpdate(req.params.eventId, {
    averageRating: Number(averageRating.toFixed(1))
  });

  res.status(201).json({
    success: true,
    data: rating,
  });
});

// @desc    Update rating
// @route   PUT /api/v1/ratings/:id
// @access  Private
exports.updateRating = asyncHandler(async (req, res, next) => {
  let rating = await Rating.findById(req.params.id);
  
  if (!rating) {
    return next(new ErrorResponse(`Rating not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is rating owner or admin
  if (rating.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this rating', 403));
  }
  
  // Update rating
  rating = await Rating.findByIdAndUpdate(
    req.params.id,
    {
      rating: req.body.rating,
      comment: req.body.comment
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  // Update event average rating
  const allRatings = await Rating.find({ event: rating.event });
  const averageRating = allRatings.reduce((acc, item) => acc + item.rating, 0) / allRatings.length;
  
  await Event.findByIdAndUpdate(rating.event, {
    averageRating: Number(averageRating.toFixed(1))
  });

  res.status(200).json({
    success: true,
    data: rating,
  });
});

// @desc    Delete rating
// @route   DELETE /api/v1/ratings/:id
// @access  Private
exports.deleteRating = asyncHandler(async (req, res, next) => {
  const rating = await Rating.findById(req.params.id);
  
  if (!rating) {
    return next(new ErrorResponse(`Rating not found with id of ${req.params.id}`, 404));
  }
  
  // Make sure user is rating owner or admin
  if (rating.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this rating', 403));
  }
  
  // Get the event ID for updating average rating later
  const eventId = rating.event;
  
  // Remove rating from event
  await Event.findByIdAndUpdate(eventId, {
    $pull: { ratings: rating._id }
  });
  
  // Remove rating from user's eventRatings
  await User.findByIdAndUpdate(rating.user, {
    $pull: { eventRatings: rating._id }
  });
  
  // Delete the rating
  await rating.deleteOne();
  
  // Update event average rating
  const allRatings = await Rating.find({ event: eventId });
  let averageRating = 0;
  
  if (allRatings.length > 0) {
    averageRating = allRatings.reduce((acc, item) => acc + item.rating, 0) / allRatings.length;
  }
  
  await Event.findByIdAndUpdate(eventId, {
    averageRating: Number(averageRating.toFixed(1))
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});