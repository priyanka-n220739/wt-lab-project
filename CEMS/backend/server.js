const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const EventRegistration = require('./models/EventRegistration');
const Event = require('./models/Event');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cems';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_cems';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Connect to MongoDB
mongoose.connect(MONGO_URI, { family: 4 })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Database Connection Error!');
    console.error('Reason:', err.message);
    console.log('--- ACTION REQUIRED ---');
    console.log('1. If on college Wi-Fi, try Mobile Hotspot (Data only).');
    console.log('2. Check if your current IP is whitelisted in Atlas.');
    console.log('-----------------------');
  });

// =======================
// AUTH MIDDLEWARE
// =======================
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  next();
};

// =======================
// AUTHENTICATION ROUTES
// =======================

// Demo Mode Toggle (Set to true to skip DB check)
const DEMO_MODE = true;

// Register User
app.post('/api/auth/register', async (req, res) => {
  if (DEMO_MODE) return res.status(201).json({ message: 'DEMO MODE: User registered successfully' });
  try {
    const { collegeId, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists with this email' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const assignedRole = role === 'admin' ? 'admin' : 'student';
    const newUser = new User({ collegeId, email, password: hashedPassword, role: assignedRole });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password, loginType } = req.body;
  
  if (DEMO_MODE) {
    const role = loginType || (email.toLowerCase().includes('admin') ? 'admin' : 'student');
    const token = jwt.sign({ id: 'dummy_id', email, role }, JWT_SECRET, { expiresIn: '3h' });
    return res.status(200).json({ message: 'DEMO MODE: Login successful', token, role });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    if (loginType && user.role !== loginType) return res.status(403).json({ message: `Access denied: You are not an ${loginType}` });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '3h' });
    res.status(200).json({ message: 'Login successful', token, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// =======================
// EVENT APIs
// =======================

// ADMIN: Create Event
app.post('/api/events', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const newEvent = new Event({
      ...req.body,
      date: new Date(req.body.date)
    });
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating event', error: err.message });
  }
});

// ADMIN: Get all Events (shows everything)
app.get('/api/events', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// ADMIN: Update Event
app.put('/api/events/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedEvent) return res.status(404).json({ message: 'Event not found' });
      res.json(updatedEvent);
    } catch (err) {
      res.status(500).json({ message: 'Server error updating event' });
    }
});

// ADMIN: Delete Event
app.delete('/api/events/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const deletedEvent = await Event.findByIdAndDelete(req.params.id);
      if (!deletedEvent) return res.status(404).json({ message: 'Event not found' });
      res.json({ message: 'Event deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Server error deleting event' });
    }
});

// STUDENT & ANY AUTHENTICATED USER: Get visibly available events
app.get('/api/events/available', authMiddleware, async (req, res) => {
    try {
      const events = await Event.find({ isVisibleToStudents: true, status: { $in: ['open', 'upcoming'] } }).sort({ date: 1 });
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: 'Server error fetching available events' });
    }
});

// =======================
// REGISTRATION APIs
// =======================

// Register for an event
app.post('/api/events/register', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, department, event } = req.body;
    
    // Fetch user to get collegeId
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newRegistration = new EventRegistration({
      name,
      email,
      phone,
      department,
      event,
      collegeId: user.collegeId, // Saved from User account
      user_id: req.user.id
    });
    await newRegistration.save();
    res.status(201).json({ message: 'Successfully registered for the event' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during event registration' });
  }
});

// ADMIN: Get all event registrations
app.get('/api/events/registrations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const registrations = await EventRegistration.find().sort({ registrationDate: -1 });
    res.status(200).json(registrations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching registrations' });
  }
});

// STUDENT: Get currently logged in user's registrations
app.get('/api/user/registrations', authMiddleware, async (req, res) => {
    try {
      const registrations = await EventRegistration.find({ user_id: req.user.id }).sort({ registrationDate: -1 });
      res.status(200).json(registrations);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error fetching user registrations' });
    }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'landing.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
