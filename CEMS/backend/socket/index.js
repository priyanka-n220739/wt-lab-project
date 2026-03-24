const { Server } = require('socket.io');
const EventRegistration = require('../models/EventRegistration');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join a specific event room
        socket.on('join_event', (eventId) => {
            socket.join(eventId);
            console.log(`Socket ${socket.id} joined event ${eventId}`);
        });

        // Broadcast Announcement
        socket.on('send_announcement', (data) => {
            io.to(data.eventId).emit('receive_announcement', data);
        });

        // Broadcast Polls
        socket.on('start_poll', (data) => {
            io.to(data.eventId).emit('receive_poll', data);
        });

        socket.on('submit_vote', (data) => {
            io.to(data.eventId).emit('poll_update', data);
        });

        // Live Q&A
        socket.on('ask_question', (data) => {
            io.to(data.eventId).emit('new_question', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};

// Emit live attendance update (call from API when QR is scanned)
const emitAttendanceUpdate = async (eventId) => {
    if (!io) return;
    try {
        const total = await EventRegistration.countDocuments({ eventId });
        const attended = await EventRegistration.countDocuments({ eventId, scanned: true });
        io.to(eventId).emit('attendance_update', { total, attended, percentage: total ? Math.round((attended / total) * 100) : 0 });
    } catch (e) { console.error('emitAttendanceUpdate:', e); }
};

// Emit hackathon leaderboard update (generic - for live ranking)
const emitLeaderboardUpdate = (eventId, leaderboard) => {
    if (!io) return;
    io.to(eventId).emit('leaderboard_update', leaderboard);
};

const getIo = () => {
    if (!io) throw new Error('Socket.io not initialized!');
    return io;
};

module.exports = { initSocket, getIo, emitAttendanceUpdate, emitLeaderboardUpdate };
