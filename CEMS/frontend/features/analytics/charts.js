// Assuming Chart.js is loaded
document.addEventListener('DOMContentLoaded', () => {
    const renderChart = async () => {
        try {
            const res = await fetch('/api/advanced/analytics', {
                headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
            });
            const data = await res.json();

            const ctx = document.getElementById('analyticsChart');
            if(!ctx) return; // If canvas doesn't exist on this page, ignore

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Total Registrations', 'Actually Attended'],
                    datasets: [{
                        label: 'Attendance Stats',
                        data: [data.attendance.totalRegistrations, data.attendance.totalAttended],
                        backgroundColor: ['#3B82F6', '#10B981']
                    }]
                },
                options: { responsive: true }
            });
        } catch(e) { console.error('Error fetching analytics', e); }
    };
    
    // Check if we are on admin/organizer dashboard where chart is expected
    if(document.getElementById('analyticsChart')) {
        renderChart();
    }
});
