const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  department: { type: String, required: true },
  venue: { type: String },
  maxSeats: { type: Number },
  status: { type: String, enum: ['upcoming', 'open', 'closed'], default: 'upcoming' },
  isVisibleToStudents: { type: Boolean, default: true }
});

module.exports = mongoose.model('Event', eventSchema);
