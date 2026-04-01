const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false, default: 'Staff' },
  collegeId: { type: String, required: function(){
    return this.role==='student';
  } },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() {
    return !this.googleId; // Password required only if not OAuth user
  } },
  role: { type: String, enum: ['student', 'admin', 'organiser'], default: 'student' },
  department: { type: String, required: false },
  isCR: { type: Boolean, default: false },
  googleId: { type: String, required: false, unique: true, sparse: true } // For Google OAuth
});

module.exports = mongoose.model('User', userSchema);
