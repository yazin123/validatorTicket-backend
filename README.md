# Ticketing System Backend

This is the backend API for the ticketing system, built with Node.js, Express, and MongoDB.

## Features

- User authentication and authorization
- Ticket management
- Event management
- Exhibition management
- Payment processing with Razorpay
- Admin dashboard
- QR code verification
- Analytics and reporting

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Razorpay account

## Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory and add the following variables:
   ```
   NODE_ENV=development
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=30d
   JWT_COOKIE_EXPIRE=30
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   CLIENT_URL=http://localhost:3000
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/logout - Logout user
- GET /api/auth/me - Get current user

### Users
- GET /api/users - Get all users (admin only)
- GET /api/users/:id - Get user by ID
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user

### Tickets
- POST /api/tickets - Create a new ticket
- GET /api/tickets/my-tickets - Get user's tickets
- PUT /api/tickets/:id/events - Add events to ticket
- POST /api/tickets/verify - Verify ticket (staff/admin)
- POST /api/tickets/verify-event - Verify event (staff/admin)
- GET /api/tickets - Get all tickets (admin only)

### Events
- POST /api/events - Create a new event
- GET /api/events - Get all events
- GET /api/events/:id - Get event by ID
- PUT /api/events/:id - Update event
- DELETE /api/events/:id - Delete event

### Exhibitions
- POST /api/exhibitions - Create a new exhibition
- GET /api/exhibitions - Get all exhibitions
- GET /api/exhibitions/:id - Get exhibition by ID
- PUT /api/exhibitions/:id - Update exhibition
- DELETE /api/exhibitions/:id - Delete exhibition

### Payments
- POST /api/payments/create-order - Create payment order
- POST /api/payments/verify - Verify payment
- POST /api/payments/refund - Process refund (admin only)
- GET /api/payments/history - Get payment history (admin only)

### Admin
- GET /api/admin/stats - Get admin statistics
- GET /api/admin/reports - Get reports
- GET /api/admin/analytics - Get analytics

## Security Features

- JWT Authentication
- Password Hashing
- Rate Limiting
- XSS Protection
- CORS
- Helmet Security Headers
- Data Sanitization
- HTTP Parameter Pollution Prevention

## Error Handling

The API uses a centralized error handling mechanism with proper error messages and status codes.

## Logging

The application uses Winston for logging. Logs are stored in the `logs` directory.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 