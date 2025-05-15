const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const securityMiddleware = require('./middleware/security')
const errorHandler = require('./middleware/error')
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const ticketRoutes = require('./routes/tickets')
const exhibitionRoutes = require('./routes/exhibitions')

const app = express()

// Body parser - must be before security middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Security middleware
securityMiddleware(app)

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com' 
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/exhibitions', exhibitionRoutes)

// Error handling
app.use(errorHandler)

module.exports = app 