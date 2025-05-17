/**
 * Script to assign staff members to events
 * 
 * This script is used to assign staff members to specific events for verification
 * 
 * Usage: node assignStaffToEvents.js <staffEmail> <eventId>
 */

const mongoose = require('mongoose');
const User = require('../models/user.model');
const Event = require('../models/event.model');
const config = require('../config/db');

// Connect to MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('\nUsage: node assignStaffToEvents.js <staffEmail> <eventId>');
    console.log('\nAssign a staff member to a specific event');
    console.log('\nOptions:');
    console.log('  staffEmail   Email address of the staff member');
    console.log('  eventId      ID of the event to assign');
    console.log('\nExample:');
    console.log('  node assignStaffToEvents.js staff@example.com 6098f7b5e2b7c83214f5b234');
    console.log('\nOr use --list-users to see all staff members');
    console.log('  node assignStaffToEvents.js --list-users');
    console.log('\nOr use --list-events to see all events');
    console.log('  node assignStaffToEvents.js --list-events');
    
    mongoose.connection.close();
    return;
  }
  
  // Handle different commands
  if (args[0] === '--list-users') {
    listUsers().then(() => mongoose.connection.close());
  } else if (args[0] === '--list-events') {
    listEvents().then(() => mongoose.connection.close());
  } else {
    assignStaffToEvent(args[0], args[1])
      .then(() => mongoose.connection.close())
      .catch(err => {
        console.error('Error:', err);
        mongoose.connection.close();
      });
  }
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

// List all staff users
async function listUsers() {
  try {
    const users = await User.find({ role: { $in: ['staff', 'admin'] } })
      .select('name email role');
    
    console.log('\nStaff Members:');
    console.log('-------------');
    
    if (users.length === 0) {
      console.log('No staff members found');
      return;
    }
    
    users.forEach(user => {
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log('-------------');
    });
    
  } catch (error) {
    console.error('Error listing users:', error);
  }
}

// List all events
async function listEvents() {
  try {
    const events = await Event.find()
      .select('title startDate endDate venue')
      .populate('staffAssigned', 'name email');
    
    console.log('\nEvents:');
    console.log('-------------');
    
    if (events.length === 0) {
      console.log('No events found');
      return;
    }
    
    events.forEach(event => {
      console.log(`ID: ${event._id}`);
      console.log(`Title: ${event.title}`);
      console.log(`Start: ${new Date(event.startDate).toLocaleString()}`);
      console.log(`End: ${new Date(event.endDate).toLocaleString()}`);
      console.log(`Venue: ${event.venue}`);
      
      if (event.staffAssigned && event.staffAssigned.length > 0) {
        console.log('Assigned Staff:');
        event.staffAssigned.forEach(staff => {
          console.log(`  - ${staff.name} (${staff.email})`);
        });
      } else {
        console.log('Assigned Staff: None');
      }
      
      console.log('-------------');
    });
    
  } catch (error) {
    console.error('Error listing events:', error);
  }
}

// Assign staff to an event
async function assignStaffToEvent(staffEmail, eventId) {
  try {
    // Find the staff member
    const staff = await User.findOne({ email: staffEmail });
    
    if (!staff) {
      console.error(`User with email ${staffEmail} not found`);
      return;
    }
    
    // Check if user is staff or admin
    if (staff.role !== 'staff' && staff.role !== 'admin') {
      console.error(`User ${staffEmail} is not a staff member or admin`);
      return;
    }
    
    // Find the event
    const event = await Event.findById(eventId);
    
    if (!event) {
      console.error(`Event with ID ${eventId} not found`);
      return;
    }
    
    // Initialize staffAssigned array if it doesn't exist
    if (!event.staffAssigned) {
      event.staffAssigned = [];
    }
    
    // Check if staff is already assigned
    const isAlreadyAssigned = event.staffAssigned.some(
      id => id.toString() === staff._id.toString()
    );
    
    if (isAlreadyAssigned) {
      console.log(`Staff member ${staffEmail} is already assigned to this event`);
      return;
    }
    
    // Assign the staff member to the event
    event.staffAssigned.push(staff._id);
    await event.save();
    
    console.log(`Successfully assigned ${staff.name} (${staffEmail}) to event: ${event.title}`);
    
  } catch (error) {
    console.error('Error assigning staff to event:', error);
  }
} 