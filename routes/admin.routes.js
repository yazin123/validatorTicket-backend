const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const ticketController = require('../controllers/ticket.controller');
const { protect, authorize } = require('../middleware/auth');

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard & Analytics routes
router.get('/stats', adminController.getStats);
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/attendance', adminController.getAttendanceAnalytics);
router.get('/analytics/users', adminController.getUserRegistrationStats);
router.get('/analytics/events', adminController.getEventPerformanceStats);
router.get('/analytics/geographic', adminController.getGeographicStats);

// User management routes
router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.get('/users/:userId/tickets', adminController.getUserTickets);
router.post('/users', adminController.uploadUserImage, adminController.createUser);

// Ticket management routes
router.get('/tickets', ticketController.getTickets);
router.get('/tickets/:id', ticketController.getTicket);

// Event management routes
router.get('/events', adminController.getEvents);
router.post('/events', adminController.uploadEventMedia, adminController.createEvent);
router.get('/events/:eventId', adminController.getEventDetails);
router.put('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.put('/events/:eventId/status', adminController.updateEventStatus);
router.get('/events/:eventId/tickets', adminController.getEventTickets);

// Settings routes
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;