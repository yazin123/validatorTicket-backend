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

  /**
   * Add ticket content to PDF document
   * @param {PDFDocument} doc - PDF document
   * @param {Object} ticket - Ticket details
   * @param {string} qrCodeUrl - QR code data URL
   * @private
   */
  _addTicketContent(doc, ticket, qrCodeUrl) {
    const exhibition = ticket.exhibition;
    const events = ticket.events;

    // Header
    doc.fontSize(20).text('EXHIBITION TICKET', { align: 'center' });
    doc.moveDown();

    // Exhibition details
    doc.fontSize(16).text(exhibition.name, { align: 'center' });
    doc.fontSize(12).text(`${exhibition.venue.name}, ${exhibition.venue.city}`, { align: 'center' });
    doc.moveDown();

    // Ticket details
    doc.fontSize(14).text(`Ticket #: ${ticket.ticketNumber}`, { align: 'left' });
    doc.fontSize(12).text(`Purchase Date: ${new Date(ticket.purchaseDate).toLocaleDateString()}`, { align: 'left' });
    doc.moveDown();

    // QR Code
    doc.image(qrCodeUrl, {
      fit: [150, 150],
      align: 'center',
    });
    doc.fontSize(10).text('Scan this QR code at the entrance', { align: 'center' });
    doc.moveDown();

    // Events list
    doc.fontSize(14).text('Events:', { align: 'left' });
    events.forEach((eventItem) => {
      const event = eventItem.event;
      doc.fontSize(12).text(`• ${event.name}`, { align: 'left' });
      doc.fontSize(10).text(`  ${new Date(event.startTime).toLocaleString()} - ${new Date(event.endTime).toLocaleString()}`, { align: 'left' });
      doc.fontSize(10).text(`  Location: ${event.location}`, { align: 'left' });
      doc.moveDown(0.5);
    });
    doc.moveDown();

    // Attendees
    doc.fontSize(14).text(`Attendees (${ticket.attendees.length}):`, { align: 'left' });
    ticket.attendees.forEach((attendee) => {
      doc.fontSize(12).text(`• ${attendee.name}`, { align: 'left' });
    });
    doc.moveDown();

    // Total
    doc.fontSize(14).text(`Total Amount: ₹${ticket.totalAmount}`, { align: 'left' });
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('This ticket is non-transferable and must be presented at the entrance.', { align: 'center' });
  }
}

module.exports = new PDFService();