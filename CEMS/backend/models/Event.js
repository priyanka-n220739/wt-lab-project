const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // e.g., "10:00"
  endTime: { type: String, required: true },   // e.g., "12:00"
  department: { type: String, required: true },
  place: { type: String, required: true },      // Use 'place' as requested
  maxSeats: { type: Number },
  status: { type: String, enum: ['upcoming', 'open', 'closed'], default: 'upcoming' },
  isVisibleToStudents: { type: Boolean, default: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accessStartDate: { type: Date },
  accessEndDate: { type: Date }
});

// Proper indexing for faster conflict checks as requested
eventSchema.index({ date: 1, place: 1 });

module.exports = mongoose.model('Event', eventSchema);
