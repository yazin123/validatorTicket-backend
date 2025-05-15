// utils/asyncHandler.js
/**
 * Async/await error handler to avoid try-catch blocks in controllers
 * @param {Function} fn - Async function to handle
 * @returns {Function} Express middleware with error handling
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  
  module.exports = asyncHandler;
  
  