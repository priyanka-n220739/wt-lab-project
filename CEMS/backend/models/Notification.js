const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional, if null it's a global notification
  message: { type: String, required: true },
  type: { type: String, default: 'info' }, // 'info', 'success', 'warning', 'error'
  read: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
