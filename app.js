const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
// Load env vars
require('dotenv').config();

// Connect to database - properly invoke the connectDB function
connectDB()
  .then(() => {
    logger.info('MongoDB Connected...');
  })
  .catch((err) => {
    logger.error(`Database connection error: ${err.message}`);
    // Exit process with failure
    process.exit(1);
  });

// Route files
const v1 = require('./routes/index.routes');

// Import routes
const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const ticketRoutes = require('./routes/ticket.routes')
const eventRoutes = require('./routes/event.routes')
const adminRoutes = require('./routes/admin.routes')

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(cors());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Sanitize data
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable compression
app.use(compression());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/v1', v1);
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/tickets', ticketRoutes)
app.use('/api/v1/events', eventRoutes)
app.use('/api/v1/admin', adminRoutes)

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error',
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});