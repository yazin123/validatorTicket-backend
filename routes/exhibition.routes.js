// routes/exhibition.routes.js
const express = require('express');
const router = express.Router();
const { 
  getExhibitions, 
  getExhibition, 
  createExhibition, 
  updateExhibition, 
  deleteExhibition,
  getUpcomingExhibitions
} = require('../controllers/exhibition.controller');
const { 
  protect, 
  authorize 
} = require('../middleware/auth.middleware');
const { 
  validateExhibition, 
  validateRequest 
} = require('../middleware/validation.middleware');

// Include event routes
const eventRouter = require('./event.routes');
router.use('/:exhibitionId/events', eventRouter);

// Public routes
router.get('/', getExhibitions);
router.get('/upcoming', getUpcomingExhibitions);
router.get('/:id', getExhibition);

// Protected admin routes
router.use(protect);
router.use(authorize('admin', 'staff'));

router.post('/', validateExhibition, validateRequest, createExhibition);
router.put('/:id', validateExhibition, validateRequest, updateExhibition);
router.delete('/:id', deleteExhibition);

module.exports = router;

