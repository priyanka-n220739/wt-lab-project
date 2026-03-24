const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  collegeId: { type: String, required: function(){
    return this.role==='student';
  } },
  name: { type: String }, // For Organizer Contact chart
  phone: { type: String }, // For Organizer Contact chart
  department: { type: String }, // For Organizer Contact chart
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin', 'organizer', 'sub-organizer', 'volunteer'], default: 'student' }
});

module.exports = mongoose.model('User', userSchema);
