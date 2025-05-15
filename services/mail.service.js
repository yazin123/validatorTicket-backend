// services/mail.service.js
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email sending service
 */
class MailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text email body
   * @param {string} options.html - HTML email body
   * @returns {Promise<Object>} Email sending result
   */
  async sendEmail({ to, subject, text, html }) {
    try {
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`Email sending failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   * @param {Object} user - User details
   * @param {string} user.name - User name
   * @param {string} user.email - User email
   * @returns {Promise<Object>} Email sending result
   */
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Exhibition Ticket System',
      text: `Welcome to Exhibition Ticket System, ${user.name}!`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Welcome to Exhibition Ticket System!</h2>
          <p>Hello ${user.name},</p>
          <p>Thank you for registering with our Exhibition Ticket System. We're excited to have you on board!</p>
          <p>You can now book tickets for exciting exhibitions and events.</p>
          <p>Best regards,<br>Exhibition Ticket System Team</p>
        </div>
      `,
    });
  }

  /**
   * Send ticket confirmation email
   * @param {Object} ticket - Ticket details
   * @param {Object} user - User details
   * @param {string} qrCodeUrl - QR code data URL
   * @returns {Promise<Object>} Email sending result
   */
  async sendTicketConfirmationEmail(ticket, user, qrCodeUrl) {
    // Build event list HTML
    const eventsListHtml = ticket.events
      .map(
        (evt) => `
        <li>${evt.event.name} - ${new Date(evt.event.startTime).toLocaleString()}</li>
      `
      )
      .join('');

    return this.sendEmail({
      to: user.email,
      subject: 'Your Ticket Confirmation',
      text: `Your ticket #${ticket.ticketNumber} has been confirmed.`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Ticket Confirmation</h2>
          <p>Hello ${user.name},</p>
          <p>Your ticket has been confirmed for the following events:</p>
          <ul>
            ${eventsListHtml}
          </ul>
          <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Total Amount:</strong> ₹${ticket.totalAmount}</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrCodeUrl}" alt="Ticket QR Code" style="max-width: 200px;">
            <p><strong>Please present this QR code at the venue entrance</strong></p>
          </div>
          <p>Thank you for your purchase. We look forward to seeing you at the event!</p>
          <p>Best regards,<br>Exhibition Ticket System Team</p>
        </div>
      `,
    });
  }
}

module.exports = new MailService();





