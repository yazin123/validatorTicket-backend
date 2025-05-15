const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard routes
router.get('/stats', adminController.getStats);

// User management routes
router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.get('/users/:userId/tickets', adminController.getUserTickets);

// Event management routes
router.get('/events', adminController.getEvents);
router.post('/events', adminController.createEvent);
router.get('/events/:eventId', adminController.getEventDetails);
router.put('/events/:eventId', adminController.updateEvent);
router.delete('/events/:eventId', adminController.deleteEvent);
router.put('/events/:eventId/status', adminController.updateEventStatus);
router.get('/events/:eventId/tickets', adminController.getEventTickets);

// Settings routes
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router; 