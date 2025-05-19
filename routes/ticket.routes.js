// routes/ticket.routes.js
const express = require('express');
const router = express.Router();
const {
  getTickets,
  getMyTickets,
  getTicket,
  createTicket,
  verifyTicket,
  verifyEvent,
  addEvents,
  cancelTicket,
  getTicketByQRCode,
  updateStatusofTicket,
  markEventAttended,
  bookTicket,
  verifyTicketByDataUrl
} = require('../controllers/ticket.controller');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// User routes
router.get('/my-tickets', getMyTickets);
router.get('/me', getMyTickets);
router.post('/', createTicket);
router.post('/book', bookTicket);
// router.put('/:id/events', addEvents);

// Staff/Admin routes
router.post('/verify', authorize('staff', 'admin'), verifyTicket);
router.post('/verify-data-url', authorize('staff', 'admin'), verifyTicketByDataUrl);
// router.post('/verify-event', authorize('staff', 'admin'), verifyEvent);
router.post('/verify-qr', authorize('staff', 'admin'), getTicketByQRCode);
router.post('/mark-attended', authorize('staff', 'admin'), markEventAttended);

// Admin only routes
router.get('/', authorize('admin'), getTickets);
router.get('/:id', getTicket);
router.put('/:id/status', authorize('admin'), updateStatusofTicket);
router.put('/:id/cancel', authorize('admin'), cancelTicket);

module.exports = router;

