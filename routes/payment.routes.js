// routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { 
  getPayments, 
  getMyPayments, 
  createOrder,
  verifyPayment,
  getPaymentHistory,
  processRefund
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Routes accessible to all authenticated users
router.get('/me', getMyPayments);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

// Admin-only routes
router.get('/', authorize('admin'), getPayments);
router.get('/history', authorize('admin'), getPaymentHistory);
router.post('/refund', authorize('admin'), processRefund);

module.exports = router;