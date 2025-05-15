// models/exhibition.model.js
const mongoose = require('mongoose');

const exhibitionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exhibition name is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Exhibition description is required'],
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
  },
  venue: {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
    },
    address: {
      type: String,
      required: [true, 'Venue address is required'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  mapLayout: {
    type: String, // URL to map image or data
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed'],
    default: 'upcoming',
  },
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  }],
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

exhibitionSchema.pre('findOneAndUpdate', function () {
  this.set({ updatedAt: Date.now() });
});

module.exports = mongoose.model('Exhibition', exhibitionSchema);

