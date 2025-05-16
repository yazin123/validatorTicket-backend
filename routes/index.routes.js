// routes/index.routes.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const eventRoutes = require('./event.routes');
const ticketRoutes = require('./ticket.routes');
const paymentRoutes = require('./payment.routes');
const ratingRoutes = require('./rating.routes');
const adminRoutes = require('./admin.routes');

// Mount routers
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/tickets', ticketRoutes);
router.use('/payments', paymentRoutes);
router.use('/ratings', ratingRoutes);

// Base route for API health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    version: '1.0.0'
  });
});

module.exports = router;