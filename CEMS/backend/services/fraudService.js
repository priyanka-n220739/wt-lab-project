/**
 * Fraud Detection Service - Tracks suspicious activity for admin dashboard
 * Safe addition - no conflicts with existing code
 */
const mongoose = require('mongoose');

// In-memory store for IP/email rate tracking (use Redis in production)
const ipRegistrationCount = new Map();
const emailRegistrationTimes = new Map();
const SUSPICIOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RAPID_REG_THRESHOLD = 3; // 3+ regs in 1 hour from same IP = suspicious

/**
 * Record registration attempt for fraud detection
 */
function recordRegistrationAttempt(ip, email, registrationId) {
  const now = Date.now();
  if (!ipRegistrationCount.has(ip)) {
    ipRegistrationCount.set(ip, []);
  }
  const ipRecords = ipRegistrationCount.get(ip);
  ipRecords.push({ time: now, email, registrationId });
  // Keep only last hour
  const cutoff = now - SUSPICIOUS_WINDOW_MS;
  while (ipRecords.length && ipRecords[0].time < cutoff) ipRecords.shift();

  if (!emailRegistrationTimes.has(email)) {
    emailRegistrationTimes.set(email, []);
  }
  const emailRecords = emailRegistrationTimes.get(email);
  emailRecords.push(now);
  while (emailRecords.length && emailRecords[0] < cutoff) emailRecords.shift();
}

/**
 * Check if IP has suspicious activity
 */
function isSuspiciousIP(ip) {
  const records = ipRegistrationCount.get(ip) || [];
  const cutoff = Date.now() - SUSPICIOUS_WINDOW_MS;
  const recent = records.filter(r => r.time > cutoff);
  return recent.length >= RAPID_REG_THRESHOLD;
}

/**
 * Get suspicious registrations for admin dashboard
 */
function getSuspiciousActivity() {
  const now = Date.now();
  const cutoff = now - SUSPICIOUS_WINDOW_MS;
  const suspicious = [];
  ipRegistrationCount.forEach((records, ip) => {
    const recent = records.filter(r => r.time > cutoff);
    if (recent.length >= RAPID_REG_THRESHOLD) {
      const uniqueEmails = [...new Set(recent.map(r => r.email))];
      suspicious.push({ ip, count: recent.length, emails: uniqueEmails, lastActivity: Math.max(...recent.map(r => r.time)) });
    }
  });
  return suspicious.sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * Clear old data (call periodically)
 */
function cleanupOldData() {
  const cutoff = Date.now() - SUSPICIOUS_WINDOW_MS * 24; // 24 hours
  ipRegistrationCount.forEach((records, ip) => {
    const filtered = records.filter(r => r.time > cutoff);
    if (filtered.length === 0) ipRegistrationCount.delete(ip);
    else ipRegistrationCount.set(ip, filtered);
  });
}

// Cleanup every hour
setInterval(cleanupOldData, 60 * 60 * 1000);

module.exports = {
  recordRegistrationAttempt,
  isSuspiciousIP,
  getSuspiciousActivity
};
