const rateLimit = require('express-rate-limit');

/**
 * General purpose rate limiter for all routes
 * Limits requests to 100 per 10 minutes per IP
 */
const generalRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 10 minutes'
  }
});

/**
 * Login rate limiter
 * Limits login attempts to 5 per 15 minutes per IP
 * Helps prevent brute force attacks
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes'
  }
});

/**
 * Registration rate limiter
 * Limits registration attempts to 3 per hour per IP
 * Helps prevent mass account creation
 */
const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes (1 hour)
  max: 3, // limit each IP to 3 registration attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many registration attempts, please try again after an hour'
  }
});

/**
 * Stricter rate limiter for authentication routes
 * Limits requests to 10 per 15 minutes per IP
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again after 15 minutes'
  }
});

/**
 * Rate limiter for sensitive operations (password reset, etc.)
 * Limits requests to 3 per 60 minutes per IP
 */
const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests for this operation, please try again later'
  }
});

module.exports = {
  generalRateLimiter,
  authRateLimiter,
  sensitiveRateLimiter,
  loginRateLimiter,
  registrationRateLimiter
};