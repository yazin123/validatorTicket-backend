// services/payment.service.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Mock Payment gateway service
 * (Bypass for Razorpay integration until account is set up)
 */
class PaymentService {
  static razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  constructor() {
    // No need for Razorpay instance
    this.orderPrefix = 'mock_order_';
    this.paymentPrefix = 'mock_payment_';
    this.secretKey = process.env.MOCK_PAYMENT_SECRET || 'mock_payment_secret_key';
  }

  /**
   * Generate a random ID with prefix
   * @param {string} prefix - ID prefix
   * @returns {string} Generated ID
   */
  _generateId(prefix) {
    const randomString = crypto.randomBytes(12).toString('hex');
    return `${prefix}${randomString}`;
  }

  /**
   * Create payment order
   * @param {Object} orderData - Order data
   * @param {string} orderData.amount - Amount in smallest currency unit (paise)
   * @param {string} orderData.receipt - Order receipt ID
   * @param {string} orderData.currency - Currency code (default: INR)
   * @param {Object} orderData.notes - Additional notes
   * @returns {Promise<Object>} Created order
   */
  async createOrder({ amount, receipt, currency = 'INR', notes = {} }) {
    try {
      // Create mock order
      const orderId = this._generateId(this.orderPrefix);
      
      const order = {
        id: orderId,
        entity: 'order',
        amount: Math.round(amount * 100), // Convert to paise
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency,
        receipt,
        status: 'created',
        attempts: 0,
        notes,
        created_at: Date.now()
      };
      
      logger.info(`Mock payment order created: ${order.id}`);
      return order;
    } catch (error) {
      logger.error(`Failed to create mock payment order: ${error.message}`);
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   * @param {string} orderId - Mock order ID
   * @param {string} paymentId - Mock payment ID
   * @param {string} signature - Mock signature
   * @returns {boolean} Is signature valid
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      // Create signature verification string (same logic as Razorpay for easy transition later)
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      
      // For mock implementation, always return true if using our generated IDs
      // Or validate if using actual signatures for testing
      const isValid = (
        // Check if using mock IDs (auto-validate)
        (orderId.startsWith(this.orderPrefix) && paymentId.startsWith(this.paymentPrefix)) ||
        // Or validate signature
        (expectedSignature === signature)
      );
      
      if (isValid) {
        logger.info(`Mock payment signature verified for order: ${orderId}`);
      } else {
        logger.warn(`Invalid mock payment signature for order: ${orderId}`);
      }
      
      return isValid;
    } catch (error) {
      logger.error(`Mock signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Fetch payment details
   * @param {string} paymentId - Mock payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      // In a real implementation, we'd fetch from Razorpay
      // For mock, return a realistic payment object
      return {
        id: paymentId,
        entity: 'payment',
        amount: 0, // This would normally be populated from DB
        currency: 'INR',
        status: 'captured',
        order_id: '', // This would normally be populated from DB
        method: 'card',
        card_id: null,
        description: 'Mock payment for testing',
        email: '',
        contact: '',
        fee: 0,
        tax: 0,
        created_at: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to fetch mock payment details: ${error.message}`);
      throw new Error(`Failed to fetch payment details: ${error.message}`);
    }
  }

  /**
   * Issue refund
   * @param {string} paymentId - Mock payment ID
   * @param {number} amount - Refund amount in smallest currency unit (paise)
   * @returns {Promise<Object>} Refund details
   */
  async issueRefund(paymentId, amount = null) {
    try {
      const refundId = crypto.randomBytes(12).toString('hex');
      const refundAmount = amount ? Math.round(amount * 100) : 0;
      
      const refund = {
        id: `mock_refund_${refundId}`,
        entity: 'refund',
        amount: refundAmount,
        currency: 'INR',
        payment_id: paymentId,
        notes: {},
        receipt: null,
        acquirer_data: {},
        created_at: Date.now()
      };
      
      logger.info(`Mock refund issued for payment: ${paymentId}`);
      return refund;
    } catch (error) {
      logger.error(`Mock refund failed: ${error.message}`);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Generate payment ID and signature for testing
   * @param {string} orderId - Order ID
   * @returns {Object} Payment ID and signature
   */
  generatePaymentCredentials(orderId) {
    const paymentId = this._generateId(this.paymentPrefix);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    
    return {
      paymentId,
      signature
    };
  }

  static async createOrder(amount, currency = 'INR') {
    try {
      const options = {
        amount: amount * 100, // Razorpay expects amount in paise
        currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error) {
      throw new Error(`Error creating payment order: ${error.message}`);
    }
  }

  static async verifyPayment(paymentId, orderId, signature) {
    try {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === signature;
      return isValid;
    } catch (error) {
      throw new Error(`Error verifying payment: ${error.message}`);
    }
  }

  static async refundPayment(paymentId, amount) {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount * 100, // Convert to paise
      });
      return refund;
    } catch (error) {
      throw new Error(`Error processing refund: ${error.message}`);
    }
  }
}

module.exports = new PaymentService();