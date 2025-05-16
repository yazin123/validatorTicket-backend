// routes/event.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const { getEvents, getEvent, createEvent, updateEvent, deleteEvent } = require('../controllers/event.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateEvent, validateRequest } = require('../middleware/validation.middleware');

// Include rating routes
const ratingRouter = require('./rating.routes');
router.use('/:eventId/ratings', ratingRouter);

// Public routes
router.get('/', getEvents);
router.get('/:id', getEvent);

// Protected admin routes
router.use(protect);
router.use(authorize('admin', 'staff'));

router.post('/', validateEvent, validateRequest, createEvent);
router.put('/:id', validateEvent, validateRequest, updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;

