const nodemailer = require('nodemailer');

class EmailService {
  static async sendTicketEmail(userEmail, ticketData, qrCode) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const mailOptions = {
        from: `"Exhibition Tickets" <${process.env.SMTP_EMAIL}>`,
        to: userEmail,
        subject: 'Your Exhibition Ticket',
        html: `
          <h1>Your Exhibition Ticket</h1>
          <p>Thank you for purchasing a ticket for ${ticketData.exhibition.name}.</p>
          <p>Ticket Number: ${ticketData.ticketNumber}</p>
          <p>Events:</p>
          <ul>
            ${ticketData.events.map(event => `
              <li>${event.event.name} - ${new Date(event.event.startTime).toLocaleString()}</li>
            `).join('')}
          </ul>
          <p>Please show this QR code at the venue:</p>
          <img src="${qrCode}" alt="Ticket QR Code" />
          <p>Number of Attendees: ${ticketData.attendees.length}</p>
          <p>Total Amount: ₹${ticketData.totalAmount}</p>
          <p>Thank you for your purchase!</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      throw new Error(`Error sending email: ${error.message}`);
    }
  }

  static async sendRegistrationEmail(userEmail, userData) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const mailOptions = {
        from: `"Exhibition Tickets" <${process.env.SMTP_EMAIL}>`,
        to: userEmail,
        subject: 'Welcome to Exhibition Tickets',
        html: `
          <h1>Welcome to Exhibition Tickets!</h1>
          <p>Hello ${userData.name},</p>
          <p>Thank you for registering with Exhibition Tickets. You can now:</p>
          <ul>
            <li>Browse upcoming exhibitions and events</li>
            <li>Purchase tickets for events</li>
            <li>View your ticket history</li>
            <li>Rate events you've attended</li>
          </ul>
          <p>We look forward to seeing you at our exhibitions!</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      throw new Error(`Error sending registration email: ${error.message}`);
    }
  }
}

module.exports = EmailService; 