# CEMS Extensions Summary – Real-Time Event Platform

All changes are **additive** and maintain **backward compatibility** with existing functionality.

---

## 1. Real-Time (Socket.IO)

**Status:** Socket.IO was already present in `backend/socket/index.js` but not wired. The server now uses `http.createServer` + `initSocket(server)`.

**New/Modified:**
- `server.js` – Uses `http.createServer(app)` and `initSocket(server)` for Socket.IO
- `socket/index.js` – Added `emitAttendanceUpdate(eventId)` and `emitLeaderboardUpdate(eventId, data)` for real-time attendance and leaderboard updates

**Events:**
- `join_event` – Join event room
- `send_announcement` – Broadcast announcements
- `start_poll` / `submit_vote` – Live polls
- `ask_question` – Live Q&A
- `attendance_update` – Live attendance counter (emitted on QR scan)

---

## 2. Digital Event Pass + QR System

**New Files:**
- `backend/services/qrService.js` – QR generation and validation (CEMS:regId:eventId:hash)
- `frontend/features/qr/passes.html` – Student view of event passes with QR and certificate download

**Modified:**
- `backend/models/EventRegistration.js` – Added `qrCode` field
- `backend/server.js` – Generates and stores QR on event registration
- `frontend/register-event.html` – Sends `eventId` with registration, uses toast on success
- `frontend/student_dashboard.html` – Nav link to “My Event Passes”

**APIs:**
- `GET /api/user/registrations/:regId/qr` – Get QR for a registration (auth)
- `POST /api/attendance/scan` – Scan QR and mark attendance (admin/organizer)
- `GET /api/events/:eventId/attendance` – Attendance stats per event

**QR Scanning:**
- `frontend/features/qr/scanner.js` – Supports CEMS format and legacy JSON
- `frontend/features/qr/scanner.html` – Scanner page
- Admin/Organizer: “Scan QR” in sidebar

---

## 3. Certificate Generation

**New Files:**
- `backend/services/certificateService.js` – Certificate HTML generation

**API:**
- `GET /api/certificates/:registrationId` – Returns HTML certificate (print/save as PDF)

**Frontend:**
- `passes.html` – “Download Certificate” after attendance

---

## 4. Fraud Prevention

**Modified:**
- `backend/middleware/validator.js` – Expanded disposable email list
- `backend/server.js` – Uses `registerLimiter` and `blockDisposableEmails` on auth register; checks phone duplicates; records event registrations for fraud tracking

**New:**
- `backend/services/fraudService.js` – Tracks rapid registrations by IP
- `GET /api/fraud/alerts` – Admin endpoint for suspicious IPs (admin only)

**Frontend:**
- `admin_dashboard.html` – Fraud alerts card when suspicious activity exists

---

## 5. PWA (Offline Mode)

**Existing (verified):**
- `frontend/manifest.json`
- `frontend/sw.js` – Caches HTML pages, event list
- `frontend/features/pwa/install.js`

**Behavior:** Event list and basic pages are cached for offline use.

---

## 6. Analytics APIs

**New APIs (in `extendedRoutes.js`):**
- `GET /api/analytics/overview` – Total events, registrations, attended, attendance rate
- `GET /api/analytics/events` – Per-event registration and attendance stats
- `GET /api/analytics/department` – Department-wise distribution

---

## 7. Toast Notifications

**Existing:** `frontend/features/notifications/toast.js` and `toast.css`

**Updated usage:**
- `register-event.html` – Toast on registration success
- `scanner.js` – Toast on scan success/failure
- `landing.html`, dashboards – Already use toast

---

## File Summary

| Path | Type | Purpose |
|------|------|---------|
| `backend/services/qrService.js` | New | QR generation and validation |
| `backend/services/certificateService.js` | New | Certificate HTML |
| `backend/services/fraudService.js` | New | Fraud detection |
| `backend/routes/extendedRoutes.js` | New | Extended API routes |
| `backend/models/EventRegistration.js` | Modify | Added `qrCode` |
| `backend/socket/index.js` | Modify | `emitAttendanceUpdate`, `emitLeaderboardUpdate` |
| `backend/server.js` | Modify | HTTP server, Socket.IO, fraud middleware, QR on register |
| `backend/middleware/validator.js` | Modify | More disposable domains |
| `frontend/features/qr/passes.html` | New | Event passes with QR and certificates |
| `frontend/features/qr/scanner.js` | Modify | CEMS QR format and auth redirect |
| `frontend/features/realtime/socket-client.js` | Modify | Extended `attendance_update` handling |
| `frontend/register-event.html` | Modify | `eventId`, toast, success flow |
| `frontend/student_dashboard.html` | Modify | Link to Event Passes |
| `frontend/admin_dashboard.html` | Modify | Scan QR link, fraud alerts |
| `frontend/organizer_dashboard.html` | Modify | Scan QR link |

---

## How to Run

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:** Served by Express from `frontend/` at `http://localhost:3000`.

---

## Validation Checklist

- [x] Existing APIs unchanged
- [x] Socket.IO integrated
- [x] QR system for passes and scanning
- [x] Offline/PWA support
- [x] Fraud detection and alerts
- [x] Certificates for attended events
- [x] Analytics endpoints
- [x] Toast notifications
