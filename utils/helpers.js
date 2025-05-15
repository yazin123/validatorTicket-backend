// utils/helpers.js
const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Generate random token
 * @param {number} size - Size of token in bytes
 * @returns {string} Random token
 */
exports.generateRandomToken = (size = 20) => {
  return crypto.randomBytes(size).toString('hex');
};

/**
 * Generate QR code as data URL
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<string>} QR code as data URL
 */
exports.generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(data);
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
};

/**
 * Format date to locale string
 * @param {Date} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date
 */
exports.formatDate = (date, locale = 'en-US') => {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Calculate pagination values
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination values
 */
exports.getPagination = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return {
    skip,
    limit: parseInt(limit),
  };
};

/**
 * Create pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
exports.createPaginationMetadata = (page, limit, total) => {
  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems: total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Sanitize object - remove undefined/null values
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
exports.sanitizeObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
};