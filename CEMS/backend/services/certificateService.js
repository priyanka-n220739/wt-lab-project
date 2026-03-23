/**
 * Certificate Service - Generates PDF certificates for attended events
 * Uses simple HTML-to-PDF approach (no external PDF lib required for basic cert)
 * Safe addition - no conflicts with existing code
 */
const EventRegistration = require('../models/EventRegistration');
const Event = require('../models/Event');
const User = require('../models/User');

/**
 * Generate certificate HTML for an attended registration
 * Returns HTML string - can be converted to PDF client-side or via puppeteer (optional)
 */
async function generateCertificateHTML(registrationId) {
  const reg = await EventRegistration.findById(registrationId)
    .populate('eventId', 'name date place department');
  if (!reg) return null;
  if (!reg.scanned) return null;

  const event = reg.eventId;
  const eventName = event?.name || reg.event;
  const eventDate = reg.scannedAt ? new Date(reg.scannedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : 'N/A';
  const participantName = reg.name || 'Participant';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; padding: 40px; color: #1a1a1a; }
    .cert { max-width: 800px; margin: 0 auto; border: 3px solid #1a56db; padding: 50px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 2rem; color: #1a56db; letter-spacing: 4px; }
    .title { text-align: center; font-size: 1.5rem; margin: 40px 0 20px; }
    .name { text-align: center; font-size: 2rem; font-weight: bold; margin: 20px 0; text-decoration: underline; text-underline-offset: 8px; }
    .text { text-align: center; font-size: 1.1rem; line-height: 1.8; margin: 20px 0; }
    .event-name { font-weight: bold; color: #1a56db; }
    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
    .date { font-size: 0.9rem; color: #666; }
    .id { font-size: 0.75rem; color: #999; }
  </style>
</head>
<body>
  <div class="cert">
    <div class="header"><h1>🎓 EDU EVENTS</h1><p>Certificate of Participation</p></div>
    <div class="title">This is to certify that</div>
    <div class="name">${participantName}</div>
    <div class="text">has successfully participated in</div>
    <div class="text"><span class="event-name">${eventName}</span></div>
    <div class="text">held on ${eventDate}</div>
    <div class="footer">
      <span class="date">Issued: ${new Date().toLocaleDateString()}</span>
      <span class="id">ID: ${registrationId}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Get certificate data for API (returns HTML - frontend can print/save as PDF)
 */
async function getCertificateData(registrationId, userId) {
  const reg = await EventRegistration.findById(registrationId);
  if (!reg) return null;
  if (reg.user_id?.toString() !== userId) return null; // Only own cert
  return generateCertificateHTML(registrationId);
}

module.exports = {
  generateCertificateHTML,
  getCertificateData
};
