require('dotenv').config();
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenRouter } = require('@openrouter/sdk');

const User = require('./models/User');
const EventRegistration = require('./models/EventRegistration');
const Event = require('./models/Event');
const Issue = require('./models/Issue');
const Notification = require('./models/Notification');
const sendEmail = require('./mailer');
const { registerLimiter, blockDisposableEmails } = require('./middleware/validator');
const { initSocket, emitAttendanceUpdate } = require('./socket');
const qrService = require('./services/qrService');
const fraudService = require('./services/fraudService');
const { createExtendedRouter } = require('./routes/extendedRoutes');
const advancedRoutes = require('./routes/advanced');
const roleMiddleware = require('./middleware/roleMiddleware');

const app = express();
const server = http.createServer(app);
const io = initSocket(server);
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI ;
const JWT_SECRET = process.env.JWT_SECRET ;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Inject io into request for REST routes if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Mount advanced routes
app.use('/api/advanced', advancedRoutes);

// Connect to MongoDB
mongoose.connect(MONGO_URI, { family: 4 })
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    console.log('Database name:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('Database Connection Error!');
    console.error('Reason:', err.message);
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

// AUTHENTICATION ROUTES
 
// Demo Mode Toggle (Set to true to skip DB check)
const DEMO_MODE = false;

// Register User
app.post('/api/auth/register', registerLimiter, blockDisposableEmails, async (req, res) => {
  try {
    const { role, collegeId, email, password, name, phone, department } = req.body;

    //  basic validation
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    //  only student needs collegeId
    if (role === 'student' && !collegeId) {
      return res.status(400).json({ message: 'College ID is required for students' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    const newUser = new User({
      role,
      email,
      password: hashedPassword,
      collegeId: (role === 'student') ? collegeId : null,
      name: name || undefined,
      phone: phone || undefined,
      department: department || undefined
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error: ' + (error.message || 'unknown') });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, loginType } = req.body;

    //  Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    //  Check role (optional but safe)
    if (loginType && user.role !== loginType) {
      return res.status(403).json({ message: `Access denied: You are not an ${loginType}` });
    }

    //  Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

 
// EVENT APIs
 
// Helper to check for event conflicts (same time and place)
const checkConflict = async (date, startTime, endTime, place, excludeId = null) => {
  const eventDate = new Date(date);
  const startOfDay = new Date(eventDate);
  startOfDay.setUTCHours(0,0,0,0);
  const endOfDay = new Date(eventDate);
  endOfDay.setUTCHours(23,59,59,999);

  const escapedPlace = place.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const query = {
    date: { $gte: startOfDay, $lte: endOfDay },
    place: { $regex: new RegExp(`^${escapedPlace}$`, "i") }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingAtPlace = await Event.find(query);

  for (const conf of existingAtPlace) {
      const cStart = conf.startTime || "00:00";
      const cEnd = conf.endTime || "23:59";
      
      // Overlap logic: (NewStart < ExistEnd) && (NewEnd > ExistStart)
      if ((startTime < cEnd) && (endTime > cStart)) {
          return conf;
      }
  }
  return null;
};

// ADMIN & ORGANIZER: Create Event
app.post('/api/events', authMiddleware, roleMiddleware(['admin', 'organizer']), async (req, res) => {
  try {
    const { name, date, department, startTime, endTime, place, maxSeats, image, status, organizerId, accessStartDate, accessEndDate } = req.body;
    
    if (!name || !date || !startTime || !endTime || !place) {
      return res.status(400).json({ message: 'Required event details (name, date, time, place) are mandatory.' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ message: 'End time must be strictly after start time.' });
    }

    const conflict = await checkConflict(date, startTime, endTime, place);
    if (conflict) {
      return res.status(400).json({ 
        message: `Conflict: Another event (${conflict.name}) is already scheduled at ${place} between ${conflict.startTime} and ${conflict.endTime}.` 
      });
    }

    const eventDate = new Date(date);
    const startOfDay = new Date(eventDate);
    startOfDay.setUTCHours(0,0,0,0);

    const actualOrganizerId = req.user.role === 'admin' ? organizerId : req.user.id;

    const newEvent = new Event({
      name, date: startOfDay, department, startTime, endTime, place, maxSeats, image, status: status || 'open',
      organizerId: actualOrganizerId, accessStartDate, accessEndDate
    });
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating event', error: err.message });
  }
});

// ADMIN: Get all Events (shows everything)
app.get('/api/events', authMiddleware, adminMiddleware, async (req, res) => {
  if (DEMO_MODE) {
    return res.json([
      { _id: '1', name: 'Hackathon 2026', date: new Date(), department: 'CSE', status: 'open', isVisibleToStudents: true },
      { _id: '2', name: 'Cultural Fest', date: new Date(), department: 'Cultural', status: 'upcoming', isVisibleToStudents: true }
    ]);
  }
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// ADMIN & ORGANIZER: Update Event
app.put('/api/events/:id', authMiddleware, roleMiddleware(['admin', 'organizer']), async (req, res) => {
    try {
      const { date, startTime, endTime, place, organizerId, accessStartDate, accessEndDate } = req.body;

      // Fetch current event to fill missing fields for conflict check
      const currentEvent = await Event.findById(req.params.id);
      if (!currentEvent) return res.status(404).json({ message: 'Event not found' });

      if (req.user.role === 'organizer') {
        if (currentEvent.organizerId?.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You can only edit your own events.' });
        }
        const now = new Date();
        if (currentEvent.accessStartDate && now < currentEvent.accessStartDate) {
            return res.status(403).json({ message: 'Access to edit this event has not started yet.' });
        }
        if (currentEvent.accessEndDate && now > currentEvent.accessEndDate) {
            return res.status(403).json({ message: 'Access to edit this event has expired.' });
        }
      }

      // If we are updating timing or location, check for conflicts
      if (date || startTime || endTime || place) {

        const checkDate = date || currentEvent.date;
        const checkStart = startTime || currentEvent.startTime;
        const checkEnd = endTime || currentEvent.endTime;
        const checkPlace = place || currentEvent.place;

        if (checkStart >= checkEnd) {
          return res.status(400).json({ message: 'End time must be strictly after start time.' });
        }

        const conflict = await checkConflict(checkDate, checkStart, checkEnd, checkPlace, req.params.id);
        if (conflict) {
          return res.status(400).json({ 
            message: `Conflict: Another event (${conflict.name}) is already scheduled at ${checkPlace} between ${conflict.startTime} and ${conflict.endTime}.` 
          });
        }
      }

      // If date is provided, normalize it
      if (req.body.date) {
        const d = new Date(req.body.date);
        d.setUTCHours(0,0,0,0);
        req.body.date = d;
      }

      // Admin only fields override
      if (req.user.role !== 'admin') {
         delete req.body.organizerId;
         delete req.body.accessStartDate;
         delete req.body.accessEndDate;
      }

      const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedEvent) return res.status(404).json({ message: 'Event not found' });
      res.json(updatedEvent);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error updating event', error: err.message });
    }
});

// ADMIN: Delete Event
app.delete('/api/events/:id', authMiddleware, adminMiddleware, async (req, res) => {
    if (DEMO_MODE) {
      return res.json({ message: 'DEMO MODE: Event deleted successfully' });
    }
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
    if (DEMO_MODE) {
      return res.json([
        { _id: '1', name: 'Hackathon 2026', date: new Date(), department: 'CSE', status: 'open', isVisibleToStudents: true },
        { _id: '2', name: 'Cultural Fest', date: new Date(), department: 'Cultural', status: 'upcoming', isVisibleToStudents: true },
        { _id: '3', name: 'Mega Dance 2026', date: new Date(), department: 'Cultural', status: 'open', isVisibleToStudents: true }
      ]);
    }
    try {
      const events = await Event.find({ isVisibleToStudents: true, status: { $in: ['open', 'upcoming'] } }).sort({ date: 1 });
      res.json(events);
    } catch (err) {
      res.status(500).json({ message: 'Server error fetching available events' });
    }
});

// =======================
// ISSUES APIs
// =======================

// ORGANIZER: Create Issue
app.post('/api/issues', authMiddleware, roleMiddleware(['organizer']), async (req, res) => {
  try {
    const { eventName, description } = req.body;
    if (!eventName || !description) return res.status(400).json({ message: 'Event name and description are required' });
    
    // Fetch user to get name
    const user = await User.findById(req.user.id);

    const newIssue = new Issue({
      organizerId: req.user.id,
      organizerName: user.name || user.email,
      eventName,
      description
    });
    await newIssue.save();
    res.status(201).json(newIssue);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating issue' });
  }
});

// ADMIN/ORGANIZER: Get Issues
app.get('/api/issues', authMiddleware, roleMiddleware(['admin', 'organizer']), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'organizer') {
      query.organizerId = req.user.id;
    }
    const issues = await Issue.find(query).sort({ dateSubmitted: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching issues' });
  }
});

// ADMIN: Update Issue Status
app.put('/api/issues/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const issue = await Issue.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Send Notification and Email to Organizer
    const orgUser = await User.findById(issue.organizerId);
    if (orgUser) {
       const notif = new Notification({ userId: orgUser._id, message: `Your issue regarding ${issue.eventName} has been ${status}.`, type: status === 'Approved' ? 'success' : (status === 'Pending' ? 'warning' : 'error') });
       await notif.save();
       sendEmail(orgUser.email, `Issue Update: ${status}`, `Hello ${orgUser.name || 'Organizer'},\n\nYour issue for ${issue.eventName} has been updated to: ${status}.\n\nRegards,\nEduEvents Admin`);
    }

    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating issue' });
  }
});

// =======================
// NOTIFICATIONS APIs
// =======================

// ANY AUTHORIZED: Get Notifications
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      $or: [{ userId: req.user.id }, { userId: null }] 
    }).sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
});

// ANY AUTHORIZED: Mark Notification Read
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating notification' });
  }
});

// ADMIN: Create Notification
app.post('/api/notifications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, message, type } = req.body;
    const notif = new Notification({ userId: userId || null, message, type });
    await notif.save();
    res.status(201).json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating notification' });
  }
});

// =======================
// ORGANIZERS API (Contact Chart)
// =======================
app.get('/api/organizers', authMiddleware, async (req, res) => {
  try {
    const organizers = await User.find({ role: 'organizer' }).select('-password');
    // If student, mask email and phone
    if (req.user.role === 'student' || req.user.role === 'volunteer') {
      const limited = organizers.map(org => ({
        _id: org._id,
        name: org.name,
        department: org.department,
        email: '***@***', // obfuscated
        phone: '***-***-****',
        role: org.role
      }));
      return res.json(limited);
    }
    // Else Admin or other Organizers can see full
    res.json(organizers);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching organizers' });
  }
});

// =======================
// REGISTRATION APIs
// =======================

// Register for an event
app.post('/api/events/register', authMiddleware, blockDisposableEmails, async (req, res) => {
  try {
    const { name, email, phone, department, event, eventId } = req.body;
    
    // Fetch user to get collegeId
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 🔍 Find the event details for timing
    let targetEvent;
    if (eventId) {
      targetEvent = await Event.findById(eventId);
    } else {
      targetEvent = await Event.findOne({ name: event }); // Fallback to name if ID isn't provided
    }

    if (!targetEvent) return res.status(404).json({ message: 'Event not found' });

    // 🔍 Check Student conflicts (overlapping registrations)
    const existingRegistrations = await EventRegistration.find({ user_id: req.user.id });
    
    for (const reg of existingRegistrations) {
        // First check if already registered for the EXACT same event
        if (reg.eventId && reg.eventId.toString() === targetEvent._id.toString()) {
            return res.status(400).json({ message: `You have already registered for '${targetEvent.name}'.` });
        }

        let regEvent = await Event.findById(reg.eventId);
        if (!regEvent) {
          regEvent = await Event.findOne({ name: reg.event });
        }

        if (regEvent && regEvent._id.toString() !== targetEvent._id.toString()) {
            const regDateStr = new Date(regEvent.date).toISOString().split('T')[0];
            const targetDateStr = new Date(targetEvent.date).toISOString().split('T')[0];

            if (regDateStr === targetDateStr) {
                // Default legacy/missing times for safety
                const cStart = regEvent.startTime || "00:00";
                const cEnd = regEvent.endTime || "23:59";
                const tStart = targetEvent.startTime || "00:00";
                const tEnd = targetEvent.endTime || "23:59";
                
                // Overlap: (NewStart < ExistEnd) && (NewEnd > ExistStart)
                if ((tStart < cEnd) && (tEnd > cStart)) {
                    return res.status(400).json({ 
                        message: `Time Slot Conflict: You are already registered for '${regEvent.name}' which is scheduled from ${cStart} to ${cEnd} on this day.` 
                    });
                }
            }
        }
    }

    const newRegistration = new EventRegistration({
      name, email, phone, department,
      event: targetEvent.name,
      eventId: targetEvent._id,
      collegeId: user.collegeId,
      user_id: req.user.id,
      registrationDate: new Date()
    });
    await newRegistration.save();

    // Generate & store QR code for event pass
    try {
      const qrDataURL = await qrService.generateQRDataURL(newRegistration._id.toString(), targetEvent._id.toString());
      newRegistration.qrCode = qrDataURL;
      await newRegistration.save();
    } catch (e) { console.error('QR generation:', e); }

    // Record for fraud detection
    fraudService.recordRegistrationAttempt(req.ip || req.connection?.remoteAddress || 'unknown', email, newRegistration._id.toString());

    // Send Alert and Email
    const notif = new Notification({ userId: req.user.id, message: `You have successfully registered for ${targetEvent.name}.`, type: 'success' });
    await notif.save();
    sendEmail(email, `Registration Confirmed: ${targetEvent.name}`, `Dear ${name},\n\nYou have successfully registered for ${targetEvent.name} happening on ${new Date(targetEvent.date).toLocaleDateString()} at ${targetEvent.place}.\n\nRegards,\nEduEvents Team`);

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

// DEBUG: Get all users (remove in production)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// =======================
// AI CHATBOT API
// =======================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Force reload environment variables if missing
    if (!process.env.OPENROUTER_API_KEY) {
      require('dotenv').config();
    }

    // Ensure API Key is available
    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({ reply: "OpenRouter API Key is missing. Please add OPENROUTER_API_KEY to your .env file and restart server." });
    }

    const systemContent = `You are EduEvents AI Assistant. Help users to understand how to register for events. To register for an event, the user must navigate to the 'Browse Events' page (or 'register-event.html'), explore the list, and click the 'Register' button next to the event they want to attend. Keep answers concise, professional, and directly related to the CEMS web app.`;

    const apiMessages = [{ role: 'system', content: systemContent }, ...messages];

    // Native fetch request to avoid SDK misconfiguration issues
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "EduEvents"
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter API Error:', errText);
      return res.status(500).json({ reply: `API Error: ${response.status} ${response.statusText}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I am currently unable to process your request.";
    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ reply: `Sorry, I encountered a server error: ${error.message}` });
  }
});

// =======================
// SEED DUMMY DATA API
// =======================
app.post('/api/debug/seed', async (req, res) => {
  try {
    // 1. Create dummy Admin
    const salt = await bcrypt.genSalt(10);
    const pass = await bcrypt.hash('password123', salt);
    
    let admin = await User.findOne({ email: 'admin@college.edu' });
    if (!admin) {
      admin = new User({ role: 'admin', email: 'admin@college.edu', password: pass, name: 'System Admin' });
      await admin.save();
    }

    // 2. Create dummy Organizer
    let organizer = await User.findOne({ email: 'organizer@college.edu' });
    if (!organizer) {
      organizer = new User({ role: 'organizer', email: 'organizer@college.edu', password: pass, name: 'John Events', phone: '555-0101', department: 'Cultural' });
      await organizer.save();
    }

    // 3. Create dummy Student
    let student = await User.findOne({ email: 'student@college.edu' });
    if (!student) {
      student = new User({ role: 'student', email: 'student@college.edu', password: pass, collegeId: 'ST101', name: 'Alice Student' });
      await student.save();
    }

    // 4. Create dummy Events
    const ev1 = await Event.findOne({ name: 'Annual Tech Fest 2026' });
    if (!ev1) {
      const e1 = new Event({ name: 'Annual Tech Fest 2026', date: new Date(), startTime: '09:00', endTime: '18:00', department: 'CSE', place: 'Main Auditorium', maxSeats: 500, status: 'open', organizerId: organizer._id });
      await e1.save();
      const e2 = new Event({ name: 'Cultural Dance Night', date: new Date(Date.now() + 86400000), startTime: '18:00', endTime: '22:00', department: 'Arts', place: 'Open Ground', maxSeats: 1000, status: 'upcoming', organizerId: organizer._id });
      await e2.save();

      // Issues
      const is1 = new Issue({ organizerId: organizer._id, organizerName: organizer.name, eventName: 'Annual Tech Fest 2026', description: 'Need more technical equipment for the auditorium.', status: 'Pending' });
      await is1.save();

      // Registrations
      const reg1 = new EventRegistration({ user_id: student._id, eventId: e1._id, name: student.name, email: student.email, phone: '555-0202', department: 'CSE', event: e1.name, collegeId: student.collegeId });
      await reg1.save();
    }

    res.json({ message: 'Dummy data officially seeded successfully! Login with admin@college.edu, organizer@college.edu, student@college.edu. Password is password123' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Seed failed', error: err.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'landing.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
