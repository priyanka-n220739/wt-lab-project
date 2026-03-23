/**
 * Extended Routes - QR, Attendance, Certificates, Analytics, Fraud Alerts
 * New file - no conflict with existing server.js routes
 */
const express = require('express');
const EventRegistration = require('../models/EventRegistration');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const qrService = require('../services/qrService');
const certificateService = require('../services/certificateService');
const fraudService = require('../services/fraudService');
const { emitAttendanceUpdate } = require('../socket');

function createExtendedRouter(authMiddleware, adminMiddleware, roleMiddleware) {
  const router = express.Router();

  // =======================
  // QR & ATTENDANCE APIs
  // =======================

  router.get('/user/registrations/:regId/qr', authMiddleware, async (req, res) => {
  try {
    const reg = await EventRegistration.findById(req.params.regId);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    if (reg.user_id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    let qrDataURL = reg.qrCode;
    if (!qrDataURL && reg.eventId) {
      qrDataURL = await qrService.generateQRDataURL(reg._id.toString(), reg.eventId.toString());
      reg.qrCode = qrDataURL;
      await reg.save();
    }
    res.json({ qrCode: qrDataURL, registrationId: reg._id, eventId: reg.eventId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.post('/attendance/scan', authMiddleware, roleMiddleware(['admin', 'organizer']), async (req, res) => {
  try {
    const { qrData } = req.body;
    if (!qrData) return res.status(400).json({ message: 'QR data required' });
    const parsed = qrService.validateQRPayload(qrData);
    if (!parsed.valid) {
      return res.status(400).json({ message: 'Invalid or tampered QR code' });
    }
    const reg = await EventRegistration.findById(parsed.registrationId);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    if (reg.scanned) {
      return res.status(400).json({ message: 'Already marked as attended (duplicate scan)' });
    }
    reg.scanned = true;
    reg.scannedAt = new Date();
    await reg.save();
    emitAttendanceUpdate(reg.eventId);
    // Create notification for user
    const notif = new Notification({
      userId: reg.user_id,
      message: `You have been marked present for ${reg.event}. Certificate is now available.`,
      type: 'success'
    });
    await notif.save();
    res.json({
      success: true,
      message: 'Attendance marked successfully',
      registration: { name: reg.name, event: reg.event }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/events/:eventId/attendance', authMiddleware, roleMiddleware(['admin', 'organizer']), async (req, res) => {
  try {
    const total = await EventRegistration.countDocuments({ eventId: req.params.eventId });
    const attended = await EventRegistration.countDocuments({ eventId: req.params.eventId, scanned: true });
    res.json({ total, attended, percentage: total ? Math.round((attended / total) * 100) : 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/certificates/:registrationId', authMiddleware, async (req, res) => {
  try {
    const html = await certificateService.getCertificateData(req.params.registrationId, req.user.id);
    if (!html) return res.status(404).json({ message: 'Certificate not found or not yet eligible' });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/analytics/overview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const totalRegistrations = await EventRegistration.countDocuments();
    const totalAttended = await EventRegistration.countDocuments({ scanned: true });
    const attendanceRate = totalRegistrations ? Math.round((totalAttended / totalRegistrations) * 100) : 0;
    res.json({
      totalEvents,
      totalRegistrations,
      totalAttended,
      attendanceRate
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/analytics/events', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const events = await Event.find().select('name date department');
    const stats = await Promise.all(events.map(async (ev) => {
      const regs = await EventRegistration.countDocuments({ eventId: ev._id });
      const attended = await EventRegistration.countDocuments({ eventId: ev._id, scanned: true });
      return {
        eventId: ev._id,
        name: ev.name,
        date: ev.date,
        department: ev.department,
        registrations: regs,
        attended,
        rate: regs ? Math.round((attended / regs) * 100) : 0
      };
    }));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/analytics/department', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pipeline = [
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'ev' } },
      { $unwind: '$ev' },
      { $group: { _id: '$ev.department', count: { $sum: 1 }, attended: { $sum: { $cond: ['$scanned', 1, 0] } } } },
      { $sort: { count: -1 } }
    ];
    const result = await EventRegistration.aggregate(pipeline);
    res.json(result.map(r => ({ department: r._id, registrations: r.count, attended: r.attended })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  router.get('/fraud/alerts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const suspicious = fraudService.getSuspiciousActivity();
    res.json(suspicious);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

  return router;
}

module.exports = { createExtendedRouter };
