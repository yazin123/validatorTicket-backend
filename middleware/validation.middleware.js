// middleware/validation.middleware.js
const { validationResult, body, param, query } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');

// Middleware to check validation results
exports.validateRequest = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
});

// Validation for user registration
exports.validateUserRegistration = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('role')
    .optional()
    .isIn(['customer', 'staff', 'admin'])
    .withMessage('Invalid role specified'),
];

// Validation for user login
exports.validateUserLogin = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];



// Validation for creating event
exports.validateEvent = [
  body('name').notEmpty().withMessage('Event name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Valid capacity is required'),
  body('ticketPrice').isNumeric().withMessage('Valid ticket price is required'),
];

// Validation for creating ticket
exports.validateTicket = [
  body('purchasedBy').isMongoId().withMessage('Valid user ID is required'),
  body('events').isArray().withMessage('Events must be an array'),
  body('events.*.event').isMongoId().withMessage('Valid event ID is required'),
  body('attendees').isArray().withMessage('Attendees must be an array'),
  body('attendees.*.name').notEmpty().withMessage('Attendee name is required'),
  body('totalAmount').isNumeric().withMessage('Valid total amount is required'),
];

// middleware/rateLimiter.middleware.js
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs || 15 * 60 * 1000, // Default: 15 minutes
    max: max || 100, // Default: 100 requests per windowMs
    message: {
      success: false,
      error: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Specific rate limiters
exports.loginRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests
  'Too many login attempts, please try again after 15 minutes.'
);

exports.registrationRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 requests
  'Too many registration attempts, please try again after an hour.'
);

exports.generalRateLimiter = createRateLimiter();