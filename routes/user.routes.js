// routes/user.routes.js
const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser,
  createInitialAdmin,
  getProfile
} = require('../controllers/user.controller');
const { 
  protect, 
  authorize 
} = require('../middleware/auth.middleware');
const { 
  validateUserRegistration, 
  validateRequest 
} = require('../middleware/validation.middleware');

// Special route for creating initial admin (no auth required)
router.post('/setup-admin', validateUserRegistration, validateRequest, createInitialAdmin);

// Profile route - any authenticated user can access their own profile
router.get('/profile', protect, getProfile);

// All other routes are protected and require admin access
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers)
  .post(validateUserRegistration, validateRequest, createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;

