// Assuming Socket.io script is loaded before this script
if (typeof io !== 'undefined') {
    const socket = io(); // Connects to the same host that serves the page

    // Listen for real-time announcements
    socket.on('receive_announcement', (data) => {
        if(typeof showToast === 'function') {
            showToast(`📣 Announcement: ${data.message}`, 'info');
        } else {
            console.log("📣 Announcement:", data.message);
        }
    });

    // Automatically join all events if user is registered/viewing
    // We can trigger this from the specific dashboard
    window.joinEventRoom = (eventId) => {
        socket.emit('join_event', eventId);
    };

    // Listen for live attendance updates (supports both formats)
    socket.on('attendance_update', (data) => {
        if (data.targetEventId && data.count !== undefined) {
            const counterElement = document.getElementById(`attendance-counter-${data.targetEventId}`);
            if(counterElement) {
                counterElement.innerText = data.count;
                counterElement.classList.add('pulse');
                setTimeout(() => counterElement.classList.remove('pulse'), 500);
            }
        }
        if (data.attended !== undefined && data.total !== undefined) {
            const totalEl = document.getElementById('live-attendance-total');
            const attendedEl = document.getElementById('live-attendance-attended');
            if(totalEl) totalEl.innerText = data.total;
            if(attendedEl) attendedEl.innerText = data.attended;
        }
    });
}
