const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  collegeId: { type: String }, // Added for easy viewing in registrations
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  event: { type: String, required: true },
  registrationDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
