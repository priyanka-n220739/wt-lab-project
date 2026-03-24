// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
    let html5QrcodeScanner;

    const onScanSuccess = (decodedText, decodedResult) => {
        html5QrcodeScanner.pause();

        const token = localStorage.getItem('cems_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let apiUrl, body;

        if (decodedText.startsWith('CEMS:')) {
            apiUrl = '/api/attendance/scan';
            body = JSON.stringify({ qrData: decodedText });
        } else {
            try {
                const qrData = JSON.parse(decodedText);
                apiUrl = '/api/advanced/scan';
                body = JSON.stringify({ registrationId: qrData.registrationId });
            } catch (e) {
                document.getElementById('result').innerHTML = `<span class="text-red-500">❌ Invalid QR Format</span>`;
                setTimeout(() => html5QrcodeScanner.resume(), 3000);
                return;
            }
        }

        fetch(apiUrl, {
            method: 'POST',
            headers,
            body
        })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = '../../login.html';
                    return;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                const resultDiv = document.getElementById('result');
                if (data.message === 'Attendance marked successfully' || data.success) {
                    resultDiv.innerHTML = `<span class="text-green-600">✅ Success: Added to event!</span>`;
                    if(typeof showToast === 'function') showToast('Attendance successfully verified.', 'success');
                } else {
                    resultDiv.innerHTML = `<span class="text-red-600">❌ Error: ${data.message}</span>`;
                    if(typeof showToast === 'function') showToast(data.message, 'error');
                }
                setTimeout(() => html5QrcodeScanner.resume(), 3000); // Resume after 3s
            })
            .catch(err => {
                console.error(err);
                if(typeof showToast === 'function') showToast('Network Error.', 'error');
                setTimeout(() => html5QrcodeScanner.resume(), 3000);
            });

        } catch(e) {
            console.error("Invalid QR Format", e);
            document.getElementById('result').innerHTML = `<span class="text-red-500">❌ Invalid QR Code Format</span>`;
            setTimeout(() => html5QrcodeScanner.resume(), 3000);
        }
    };

    const onScanFailure = (error) => {
        // handle scan failure, usually better to ignore and keep scanning
    };

    // Initialize scanner if element exists
    if(document.getElementById('reader')) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
});
