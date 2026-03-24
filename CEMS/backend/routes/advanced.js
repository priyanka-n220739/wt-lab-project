const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const EventRegistration = require('../models/EventRegistration');
const Event = require('../models/Event');
const { getIo } = require('../socket');

// Generate QR Code for a Registration
router.get('/qr/:registrationId', async (req, res) => {
    try {
        const registration = await EventRegistration.findById(req.params.registrationId).populate('eventId');
        if (!registration) return res.status(404).json({ message: 'Registration not found' });

        const qrData = JSON.stringify({
            registrationId: registration._id,
            eventId: registration.eventId._id || registration.eventId,
            userId: registration.user_id
        });

        const qrCodeImage = await QRCode.toDataURL(qrData);
        res.json({ qrCode: qrCodeImage });
    } catch (err) {
        res.status(500).json({ message: 'Error generating QR code', error: err.message });
    }
});

// Scan QR & Mark Attendance
router.post('/scan', async (req, res) => {
    try {
        const { registrationId } = req.body;
        const registration = await EventRegistration.findById(registrationId);

        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        if (registration.scanned) {
            return res.status(400).json({ message: 'Already scanned - Duplicate entry attempt detected' });
        }

        registration.scanned = true;
        registration.scannedAt = new Date();
        await registration.save();

        // Emit socket event for live attendance counter update
        try {
            const io = getIo();
            if (registration.eventId) {
                // Count total scanned for this event
                const count = await EventRegistration.countDocuments({ eventId: registration.eventId, scanned: true });
                io.to(registration.eventId.toString()).emit('attendance_update', { count, targetEventId: registration.eventId });
            }
        } catch(e) { console.error('Socket emit error', e); }

        res.json({ message: 'Attendance marked successfully', registration });
    } catch (err) {
        res.status(500).json({ message: 'Error scanning QR', error: err.message });
    }
});

// Analytics Dashboard Data
router.get('/analytics', async (req, res) => {
    try {
        const totalEvents = await Event.countDocuments();
        
        // Distribution of statuses
        const upcomingEvents = await Event.countDocuments({ status: 'upcoming' });
        const openEvents = await Event.countDocuments({ status: 'open' });
        
        // Total vs Attended
        const totalRegistrations = await EventRegistration.countDocuments();
        const totalAttended = await EventRegistration.countDocuments({ scanned: true });

        // Registration per event
        const regsPerEvent = await EventRegistration.aggregate([
            { $group: { _id: "$event", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            overview: { totalEvents, upcomingEvents, openEvents },
            attendance: { totalRegistrations, totalAttended },
            regsPerEvent
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching analytics', error: err.message });
    }
});

module.exports = router;
