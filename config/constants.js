// config/constants.js
module.exports = {
    // User roles
    ROLES: {
      ADMIN: 'admin',
      STAFF: 'staff',
      CUSTOMER: 'customer'
    },
    
    // Event status options
    EVENT_STATUS: {
      UPCOMING: 'upcoming',
      ONGOING: 'ongoing',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled'
    },
    
    // Exhibition status options
    EXHIBITION_STATUS: {
      PLANNING: 'planning',
      ANNOUNCED: 'announced',
      ACTIVE: 'active',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled'
    },
    
    // Ticket status options
    TICKET_STATUS: {
      ACTIVE: 'active',
      USED: 'used',
      EXPIRED: 'expired',
      CANCELLED: 'cancelled'
    },
    
    // Payment status options
    PAYMENT_STATUS: {
      INITIATED: 'initiated',
      COMPLETED: 'completed',
      FAILED: 'failed',
      REFUNDED: 'refunded'
    },
    
    // Validation constants
    VALIDATION: {
      PASSWORD_MIN_LENGTH: 6,
      EMAIL_REGEX: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      PHONE_REGEX: /^[0-9]{10}$/
    },
    
    // Pagination defaults
    PAGINATION: {
      DEFAULT_PAGE: 1,
      DEFAULT_LIMIT: 10
    }
  };
  
  