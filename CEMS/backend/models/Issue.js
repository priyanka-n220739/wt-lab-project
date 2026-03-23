const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizerName: { type: String },
  eventName: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  dateSubmitted: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Issue', issueSchema);
