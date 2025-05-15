// services/qrcode.service.js
const QRCode = require('qrcode');
const crypto = require('crypto');
const Ticket = require('../models/ticket.model');
const logger = require('../utils/logger');

/**
 * QR Code generation service
 */
class QRCodeService {
  /**
   * Generate a unique QR code value
   * @param {string} ticketId - Ticket ID
   * @returns {string} Unique QR code value
   */
  generateQRCodeValue(ticketId) {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${ticketId}-${timestamp}-${randomBytes}`;
  }

  /**
   * Generate QR code as data URL
   * @param {string} data - Data to encode in QR code
   * @returns {Promise<string>} QR code as data URL
   */
  async generateQRCodeDataURL(data) {
    try {
      return await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
      });
    } catch (error) {
      logger.error(`Failed to generate QR code: ${error.message}`);
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code for ticket
   * @param {Object} ticket - Ticket data
   * @returns {Promise<string>} QR code data URL
   */
  async generateTicketQRCode(ticket) {
    try {
      // Create QR code payload with ticket details
      const payload = {
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        qrCodeValue: ticket.qrCode,
        timestamp: Date.now(),
      };

      const qrCodeData = JSON.stringify(payload);
      return await this.generateQRCodeDataURL(qrCodeData);
    } catch (error) {
      logger.error(`Failed to generate ticket QR code: ${error.message}`);
      throw error;
    }
  }

  static async generateQRCode(ticketData) {
    try {
      // Create a unique identifier for the ticket
      const ticketId = ticketData._id.toString();
      const timestamp = Date.now();
      const randomStr = crypto.randomBytes(4).toString('hex');
      const qrData = JSON.stringify({
        ticketId,
        ticketNumber: ticketData.ticketNumber,
        timestamp,
        randomStr
      });

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
      });

      return {
        qrCode: qrCodeDataUrl,
        qrData: qrData,
      };
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error(`Error generating QR code: ${error.message}`);
    }
  }

  static async verifyQRCode(qrData) {
    try {
      let ticketId;

      // First try to parse as JSON (new format)
      try {
        const qrPayload = JSON.parse(qrData);
        if (qrPayload.ticketId) {
          ticketId = qrPayload.ticketId;
        }
      } catch (parseError) {
        // If JSON parsing fails, try to find ticket by qrCode hash (old format)
        const ticket = await Ticket.findOne({ qrCode: qrData });
        if (ticket) {
          ticketId = ticket._id;
        } else {
          throw new Error('Invalid QR code: Not found in database');
        }
      }

      if (!ticketId) {
        throw new Error('Invalid QR code format: Could not determine ticket ID');
      }

      // Find the ticket in the database
      const ticket = await Ticket.findById(ticketId)
        .populate('purchasedBy', 'name email')
        .populate('exhibition', 'name')
        .populate('events.event', 'name startTime endTime location');

      if (!ticket) {
        throw new Error('Invalid ticket: Ticket not found');
      }

      // Check ticket status but don't prevent verification
      // This will just provide status information
      let statusInfo = {
        canBeUsed: true,
        statusMessage: 'Valid ticket'
      };
      
      // Invalid statuses that would prevent actual use
      const invalidStatuses = ['cancelled', 'used', 'expired'];
      
      if (invalidStatuses.includes(ticket.status)) {
        statusInfo = {
          canBeUsed: false,
          statusMessage: `Ticket status: ${ticket.status}`
        };
        logger.warn(`Attempted verification of ticket with status ${ticket.status}: ${ticket._id}`);
      }
      
      // Check payment status
      if (ticket.paymentStatus !== 'completed' && ticket.paymentStatus !== 'paid') {
        statusInfo = {
          canBeUsed: false,
          statusMessage: `Payment status: ${ticket.paymentStatus}`
        };
        logger.warn(`Attempted verification of unpaid ticket: ${ticket._id}`);
      }

      // Always return ticket information, but with status flags
      return {
        isValid: true,
        ticket,
        statusInfo
      };
    } catch (error) {
      logger.error('Error verifying QR code:', error);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }
}

module.exports = QRCodeService;