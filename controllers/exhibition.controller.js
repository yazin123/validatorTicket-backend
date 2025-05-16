// controllers/exhibition.controller.js
const Exhibition = require('../models/exhibition.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, createPaginationMetadata } = require('../utils/helpers');

// @desc    Get all exhibitions
// @route   GET /api/v1/exhibitions
// @access  Public
exports.getExhibitions = asyncHandler(async (req, res, next) => {
  console.log("getExhibitions");
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const { skip } = getPagination(page, limit);
  
  // Filter by status if provided
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const total = await Exhibition.countDocuments(filter);
  const exhibitions = await Exhibition.find(filter)
    .populate('events', 'name startTime endTime')
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    pagination: createPaginationMetadata(page, limit, total),
    data: exhibitions,
  });
});

// @desc    Get single exhibition
// @route   GET /api/v1/exhibitions/:id
// @access  Public
exports.getExhibition = asyncHandler(async (req, res, next) => {
  const exhibition = await Exhibition.findById(req.params.id)
    .populate('events')
    .populate('organizer', 'name email');

  if (!exhibition) {
    return next(new ErrorResponse(`Exhibition not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: exhibition,
  });
});

// @desc    Create new exhibition
// @route   POST /api/v1/exhibitions
// @access  Private/Admin
exports.createExhibition = asyncHandler(async (req, res, next) => {
  // Add organizer (current user) to req.body
  req.body.organizer = req.user.id;

  const exhibition = await Exhibition.create(req.body);

  res.status(201).json({
    success: true,
    data: exhibition,
  });
});

// @desc    Update exhibition
// @route   PUT /api/v1/exhibitions/:id
// @access  Private/Admin
exports.updateExhibition = asyncHandler(async (req, res, next) => {
  let exhibition = await Exhibition.findById(req.params.id);

  if (!exhibition) {
    return next(new ErrorResponse(`Exhibition not found with id of ${req.params.id}`, 404));
  }

  exhibition = await Exhibition.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: exhibition,
  });
});

// @desc    Delete exhibition
// @route   DELETE /api/v1/exhibitions/:id
// @access  Private/Admin
exports.deleteExhibition = asyncHandler(async (req, res, next) => {
  const exhibition = await Exhibition.findById(req.params.id);

  if (!exhibition) {
    return next(new ErrorResponse(`Exhibition not found with id of ${req.params.id}`, 404));
  }

  await exhibition.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get upcoming exhibitions
// @route   GET /api/v1/exhibitions/upcoming
// @access  Public
exports.getUpcomingExhibitions = asyncHandler(async (req, res, next) => {
  const now = new Date();
  
  const exhibitions = await Exhibition.find({
    startDate: { $gt: now }
  })
    .sort('startDate')
    .populate('events', 'name startTime endTime');

  res.status(200).json({
    success: true,
    count: exhibitions.length,
    data: exhibitions,
  });
});

