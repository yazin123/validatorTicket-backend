// routes/event.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const { getEvents, getEvent, createEvent, updateEvent, deleteEvent, addShow, updateShow, deleteShow } = require('../controllers/event.controller');
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

router.post('/:id/shows', addShow);
router.put('/:id/shows/:showId', updateShow);
router.delete('/:id/shows/:showId', deleteShow);

module.exports = router;

