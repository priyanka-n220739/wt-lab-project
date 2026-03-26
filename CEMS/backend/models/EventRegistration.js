const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // To fetch timing details easily
  collegeId: { type: String }, // Added for easy viewing in registrations
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  event: { type: String, required: true }, // Keeping for backwards compatibility if needed
  registrationDate: { type: Date, default: Date.now },
  isVolunteer: { type: Boolean, default: false },
  volunteerRole: { type: String, enum: ['hospitality', 'craft', 'disciplinary', 'technical', 'other'], required: false }
});

// Proper indexing for student registration conflict check as requested
eventRegistrationSchema.index({ user_id: 1 });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
