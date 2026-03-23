/**
 * QR Code Service - Generates and validates QR codes for event passes
 * Safe addition - no conflicts with existing code
 */
const QRCode = require('qrcode');
const crypto = require('crypto');

const QR_SECRET = process.env.JWT_SECRET || 'cems-qr-secret';

/**
 * Generate a unique QR payload for a registration
 * Format: CEMS:registrationId:hash (hash prevents tampering)
 */
function generateQRPayload(registrationId, eventId) {
  const payload = `${registrationId}:${eventId}`;
  const hash = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').slice(0, 16);
  return `CEMS:${registrationId}:${eventId}:${hash}`;
}

/**
 * Generate QR code as Data URL (for display in browser)
 */
async function generateQRDataURL(registrationId, eventId) {
  const payload = generateQRPayload(registrationId, eventId);
  return QRCode.toDataURL(payload, { width: 256, margin: 2 });
}

/**
 * Validate and parse QR payload - returns { registrationId, eventId, valid }
 */
function validateQRPayload(qrData) {
  try {
    if (!qrData || !qrData.startsWith('CEMS:')) return { valid: false };
    const parts = qrData.split(':');
    if (parts.length < 4) return { valid: false };
    const [, registrationId, eventId, hash] = parts;
    const payloadStr = `${registrationId}:${eventId}`;
    const expectedHash = crypto.createHmac('sha256', QR_SECRET).update(payloadStr).digest('hex').slice(0, 16);
    if (hash !== expectedHash) return { valid: false };
    return { valid: true, registrationId, eventId };
  } catch {
    return { valid: false };
  }
}

/**
 * Parse minimal QR (CEMS:regId:eventId:hash)
 */
function parseQRPayload(qrData) {
  const result = validateQRPayload(qrData);
  return result.valid ? { registrationId: result.registrationId, eventId: result.eventId } : null;
}

module.exports = {
  generateQRPayload,
  generateQRDataURL,
  validateQRPayload,
  parseQRPayload
};
