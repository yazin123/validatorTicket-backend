/**
 * Script to generate unique QR codes for all existing users
 * 
 * This is a one-time migration script to add QR codes to users who were
 * created before this feature was added.
 * 
 * Usage: node migrateUserQRCodes.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/user.model');
const config = require('../config/db');
const logger = require('../utils/logger');

// Connect to MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  migrateUsers().then(() => {
    console.log('Migration complete');
    mongoose.connection.close();
  });
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

async function migrateUsers() {
  try {
    // Find all users who don't have a QR code
    const users = await User.find({ qrCode: { $exists: false } });
    
    console.log(`Found ${users.length} users without QR codes`);
    
    if (users.length === 0) {
      console.log('No users need migration');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // Update each user with a unique QR code
    for (const user of users) {
      try {
        // Generate a unique QR code
        const qrCode = `USER-${crypto.randomBytes(10).toString('hex')}`;
        
        // Update the user
        user.qrCode = qrCode;
        await user.save();
        
        migratedCount++;
        console.log(`Migrated user ${user.email} with QR code ${qrCode}`);
      } catch (error) {
        errorCount++;
        console.error(`Error migrating user ${user.email || user._id}:`, error);
      }
    }
    
    console.log('\nMigration Summary:');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Failed migrations: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration error:', error);
  }
} 