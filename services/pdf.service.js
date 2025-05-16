// services/pdf.service.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * PDF generation service for tickets
 */
class PDFService {
  /**
   * Generate ticket PDF
   * @param {Object} ticket - Ticket details with populated relations
   * @param {string} qrCodeUrl - QR code data URL
   * @returns {Promise<Buffer>} PDF document as buffer
   */
  async generateTicketPDF(ticket, qrCodeUrl) {
    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
        });

        // Buffer to store PDF
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Add content to PDF
        this._addTicketContent(doc, ticket, qrCodeUrl);

        // Finalize PDF
        doc.end();
      } catch (error) {
        logger.error(`Failed to generate ticket PDF: ${error.message}`);
        reject(error);
      }
    });
  }


}

module.exports = new PDFService();