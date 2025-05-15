const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const hpp = require('hpp')

const securityMiddleware = (app) => {
  // Basic security headers
  app.use(helmet())

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  })
  app.use('/api/', limiter)

  // Prevent parameter pollution
  app.use(hpp())

  // Custom XSS and NoSQL injection protection middleware
  app.use((req, res, next) => {
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Remove MongoDB operators
          req.body[key] = req.body[key].replace(/\$/, '')
          // Remove XSS characters
          req.body[key] = req.body[key].replace(/[<>]/g, '')
        }
      })
    }
    next()
  })
}

module.exports = securityMiddleware 