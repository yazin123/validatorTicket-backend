// models/event.model.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    trim: true,
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },

  startDate: {
    type: Date,
    required: [true, 'Please add a start time']
  },
  endDate: {
    type: Date,
    required: [true, 'Please add an end time']
  },
  venue: {
    type: String,
    required: [true, 'Please add a venue']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please add a category'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price cannot be negative']
  },
  capacity: {
    type: Number,
    required: [true, 'Please add a capacity'],
    min: [1, 'Capacity must be at least 1']
  },

  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  image: {
    type: String,
    default: 'default-event.jpg'
  },
  gallery: [String],
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  features: [String],
  terms: {
    type: String,
    trim: true,
    maxlength: [1000, 'Terms cannot be more than 1000 characters']
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate tickets
eventSchema.virtual('tickets', {
  ref: 'Ticket',
  localField: '_id',
  foreignField: 'event',
  justOne: false
});

// Check if event is sold out
eventSchema.virtual('isSoldOut').get(function () {
  return this.ticketsSold >= this.capacity;
});

// Check if event is upcoming
eventSchema.virtual('isUpcoming').get(function () {
  return this.date > new Date() && this.status === 'published';
});

// Check if event is past
eventSchema.virtual('isPast').get(function () {
  return this.date < new Date();
});

// Check if event is active
eventSchema.virtual('isActive').get(function () {
  if (!this.startTime || !this.endTime || !this.date) return false;

  const now = new Date();
  const eventDate = new Date(this.date);

  const [startHours, startMinutes] = this.startTime.split(':').map(Number);
  const [endHours, endMinutes] = this.endTime.split(':').map(Number);

  const startDateTime = new Date(eventDate);
  startDateTime.setHours(startHours, startMinutes);

  const endDateTime = new Date(eventDate);
  endDateTime.setHours(endHours, endMinutes);

  return now >= startDateTime && now <= endDateTime && this.status === 'published';
});

// Update ticketsSold when tickets are created/deleted
eventSchema.methods.updateTicketsSold = async function () {
  const ticketsSold = await this.model('Ticket').countDocuments({
    event: this._id,
    status: 'valid'
  });

  this.ticketsSold = ticketsSold;
  await this.save();
};

module.exports = mongoose.model('Event', eventSchema);

