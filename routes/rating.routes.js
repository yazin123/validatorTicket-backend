// routes/rating.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const { 
  getRatings, 
  getEventRatings, 
  addRating, 
  updateRating, 
  deleteRating 
} = require('../controllers/rating.controller');
const { 
  protect, 
  authorize 
} = require('../middleware/auth.middleware');

// Public route for getting event ratings
router.get('/', getEventRatings);

// Routes requiring authentication
router.use(protect);

// Route for adding ratings (all authenticated users)
router.post('/', addRating);

// Routes for updating/deleting own ratings
router.put('/:id', updateRating);
router.delete('/:id', deleteRating);

// Admin-only route for getting all ratings
router.get('/all', authorize('admin'), getRatings);

module.exports = router;

