require('dotenv').config();
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

const cron = require('node-cron');


const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
// EMAIL CONFIGURATION (Brevo API)
// =======================
const sendEmail = async (to, subject, text, html) => {
  if (!process.env.BREVO_API_KEY) {
    console.log('BREVO_API_KEY missing in .env. Skipping email send for:', to);
    return;
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { email: 'bethapriyanka76@gmail.com', name: 'EduEvents Team' },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Failed to send email to ${to}:`, errorData);
    } else {
      console.log(`Email successfully sent to ${to}`);
    }
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
  }
};

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

const staffMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'organiser') {
    return res.status(403).json({ message: 'Access denied: Staff only' });
  }
  next();
};


// AUTHENTICATION ROUTES

// Demo Mode Toggle (Set to true to skip DB check)
const DEMO_MODE = false;

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const { role, collegeId, email, password, department, name, isCR } = req.body;

    // basic validation
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    // organiser needs department
    if (role === 'organiser' && !department) {
      return res.status(400).json({ message: 'Department is required for organisers' });
    }

    //  only student needs collegeId
    if (role === 'student' && !collegeId) {
      return res.status(400).json({ message: 'College ID is required for students' });
    }

    //  check existing
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user
    const newUser = new User({
      name: name || 'User',
      role,
      email,
      password: hashedPassword,
      collegeId: (role === 'admin' || role === 'organiser') ? null : collegeId,
      department: (role === 'organiser' || (role === 'student' && department)) ? department : null,
      isCR: isCR || false
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
        role: user.role,
        department: user.department
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
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(eventDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

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

// ADMIN/ORGANISER: Create Event
app.post('/api/events', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    const { name, date, department, startTime, endTime, place, maxSeats, image, status } = req.body;

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

    if (req.user.role === 'organiser' && department !== req.user.department && department !== 'All') {
      return res.status(403).json({ message: `Organisers can only create events for their department (${req.user.department})` });
    }

    const eventDate = new Date(date);
    const startOfDay = new Date(eventDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const newEvent = new Event({
      name, date: startOfDay, department, startTime, endTime, place, maxSeats, image, status: status || 'open'
    });
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    console.error('Event Creation Error:', err);
    res.status(500).json({ message: 'Server error creating event', error: err.message });
  }
});

// ADMIN: Get all Events (shows everything)
// STAFF: Get all Events (shows everything or filtered for organiser)
app.get('/api/events', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'organiser') {
      query.$or = [{ department: req.user.department }, { department: 'All' }];
    }
    const events = await Event.find(query).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// ADMIN: Update Event
// STAFF: Update Event
app.put('/api/events/:id', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    const currentEvent = await Event.findById(req.params.id);
    if (!currentEvent) return res.status(404).json({ message: 'Event not found' });

    // Organiser check
    if (req.user.role === 'organiser' && currentEvent.department !== req.user.department) {
      return res.status(403).json({ message: 'Access denied: Organisers can only manage their department events' });
    }

    const { date, startTime, endTime, place } = req.body;

    // If we are updating timing or location, check for conflicts
    if (date || startTime || endTime || place) {
      // Fetch current event to fill missing fields for conflict check
      const currentEvent = await Event.findById(req.params.id);
      if (!currentEvent) return res.status(404).json({ message: 'Event not found' });

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
      d.setUTCHours(0, 0, 0, 0);
      req.body.date = d;
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
// STAFF: Delete Event
app.delete('/api/events/:id', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    const currentEvent = await Event.findById(req.params.id);
    if (!currentEvent) return res.status(404).json({ message: 'Event not found' });

    // Organiser check
    if (req.user.role === 'organiser' && currentEvent.department !== req.user.department) {
      return res.status(403).json({ message: 'Access denied: Organisers can only manage their department' });
    }

    await Event.findByIdAndDelete(req.params.id);
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
    const { name, email, phone, department, event, eventId, isVolunteer, volunteerRole } = req.body;

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
      isVolunteer: isVolunteer || false,
      volunteerRole: isVolunteer ? volunteerRole : null,
      registrationDate: new Date()
    });
    await newRegistration.save();

    // 📧 SEND EMAIL NOTIFICATION (REGISTRATION SUCCESSFUL)
    const emailSubject = `Confirmation: Registered for ${targetEvent.name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px;">
        <h2 style="color: #f06292;">Registration Successful! 🎉</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>You have successfully registered for <b>${targetEvent.name}</b>.</p>
        <hr/>
        <p>📅 <b>Date:</b> ${new Date(targetEvent.date).toLocaleDateString()}</p>
        <p>🕒 <b>Time:</b> ${targetEvent.startTime} - ${targetEvent.endTime}</p>
        <p>📍 <b>Venue:</b> ${targetEvent.place}</p>
        ${isVolunteer ? `<p>🙋 <b>Role:</b> Volunteer (${volunteerRole})</p>` : ''}
        <hr/>
        <p>See you there!</p>
        <p style="font-size: 0.8rem; color: #777;">Regards,<br/>EduEvents Team</p>
      </div>
    `;
    sendEmail(email, emailSubject, `Successfully registered for ${targetEvent.name}`, emailHtml);

    res.status(201).json({ message: 'Successfully registered for the event' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during event registration' });
  }
});

// ADMIN: Get all event registrations
// STAFF: Get event registrations (filtered for organiser)
app.get('/api/events/registrations', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'organiser') {
      const myEvents = await Event.find({ $or: [{ department: req.user.department }, { department: 'All' }] }).distinct('_id');
      query = { eventId: { $in: myEvents } };
    }
    const registrations = await EventRegistration.find(query).sort({ registrationDate: -1 });
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

// ADMIN: Get all users (remove in production)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// STAFF: Get CRs from their specific department
app.get('/api/department/crs', authMiddleware, staffMiddleware, async (req, res) => {
  try {
    let query = { role: 'student', isCR: true };
    if (req.user.role === 'organiser') {
      query.department = req.user.department;
    }
    const crs = await User.find(query).select('name email department collegeId');
    res.json(crs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching CRs' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'landing.html'));
});

// =======================
// SCHEDULED REMINDERS
// =======================
// Run daily at 10 AM (00 10 * * *) or every hour for testing (* * * * *)
cron.schedule('0 10 * * *', async () => {
  console.log('--- 🛡️ RUNNING DAILY EVENT REMINDERS CRON ---');
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow.setUTCHours(0, 0, 0, 0));
    const endOfTomorrow = new Date(tomorrow.setUTCHours(23, 59, 59, 999));

    // Find events happening tomorrow
    const tomorrowEvents = await Event.find({
      date: { $gte: startOfTomorrow, $lte: endOfTomorrow }
    });

    for (const ev of tomorrowEvents) {
      const registrations = await EventRegistration.find({ eventId: ev._id });
      console.log(`Sending reminders for ${ev.name} to ${registrations.length} students...`);

      for (const r of registrations) {
        const subject = `Reminder: '${ev.name}' is Tomorrow!`;
        const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee;">
                        <h2 style="color: #f06292;">Event Reminder ⏰</h2>
                        <p>Hi ${r.name},</p>
                        <p>This is a friendly reminder that the event <b>${ev.name}</b> is happening tomorrow!</p>
                        <hr/>
                        <p>📍 <b>Venue:</b> ${ev.place}</p>
                        <p>⏰ <b>Time:</b> ${ev.startTime} - ${ev.endTime}</p>
                        <hr/>
                        <p>Don't forget to be there!</p>
                    </div>
                `;
        sendEmail(r.email, subject, `Reminder: ${ev.name} is tomorrow!`, html);
      }
    }
  } catch (err) {
    console.error('Cron reminder failed:', err);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
