# CEMS – Features by Login Type

## Where to find each feature after login

---

## ADMIN LOGIN
**Login at:** `login.html` → Select **Admin** → Sign In  
**Dashboard:** `admin_dashboard.html`

| Feature | Link / Location | Description |
|--------|------------------|-------------|
| **Dashboard** | Sidebar → Dashboard | Overview, stats, charts |
| **Events** | Sidebar → Events | All college events |
| **Browse Events** | Sidebar → Browse Events | Event listing |
| **Registrations** | Sidebar → Registrations | All student registrations |
| **Attendance** | Sidebar → **Attendance** | `features/attendance/attendance.html` – View registered vs attended per event |
| **Scan QR** | Sidebar → **Scan QR** | `features/qr/scanner.html` – Scan passes to mark attendance |
| **Fraud Management** | Sidebar → **Fraud Management** | `features/fraud/fraud-alerts.html` – Suspicious registration alerts |
| **Add Event** | Sidebar → Add Event | Create new event |
| **View Issues** | Sidebar → View Issues | Organizer issues |
| **Organizers** | Sidebar → Organizers | Contact chart |
| **Notifications** | Sidebar → Notifications | Broadcast notifications |
| **Departments** | Sidebar → Departments | Department events |
| **Settings** | Sidebar → Settings | Account settings |

---

## ORGANIZER LOGIN
**Login at:** `organizer_login.html`  
**Dashboard:** `organizer_dashboard.html`

| Feature | Link / Location | Description |
|--------|------------------|-------------|
| **Dashboard** | Sidebar → Dashboard | My events |
| **Create Event** | Sidebar → Create Event | Add event |
| **Browse Events** | Sidebar → Browse Events | Event listing |
| **Attendance** | Sidebar → **Attendance** | `features/attendance/attendance.html` – Attendance stats for available events |
| **Scan QR** | Sidebar → **Scan QR** | `features/qr/scanner.html` – Scan passes to mark attendance |
| **View Students** | Sidebar → View Students | Registrations |
| **Issues** | Sidebar → Issues | Raise and view issues |
| **Notifications** | Sidebar → Notifications | Notifications |
| **Contact Chart** | Sidebar → Contact Chart | Organizers |

**Not available:** Fraud Management (admin only)

---

## STUDENT LOGIN
**Login at:** `login.html` → Select **Student** → Sign In  
**Dashboard:** `student_dashboard.html`

| Feature | Link / Location | Description |
|--------|------------------|-------------|
| **Dashboard** | Sidebar → Dashboard | My registered events |
| **Browse Events** | Sidebar → Browse Events | `register-event.html` – Register with countdown |
| **My Event Passes** | Sidebar → **My Event Passes** | `features/qr/passes.html` – QR codes and certificates |
| **Contact Organizers** | Sidebar → Contact Organizers | Organizer contacts |
| **Notifications** | Sidebar → Notifications | Personal notifications |
| **Settings** | Sidebar → Settings | Account settings |

**Not available:** Attendance, Scan QR, Fraud Management (admin/organizer only)

---

## Registration countdown

- Shown on **Browse Events** (`register-event.html`) for each event card.
- Counts down to event start date and time.
- Updates every second.
- Students and admins/organizers see it after login.

---

## Quick reference

| Feature | Admin | Organizer | Student |
|---------|:-----:|:---------:|:-------:|
| Attendance | ✅ | ✅ | ❌ |
| Scan QR | ✅ | ✅ | ❌ |
| Fraud Management | ✅ | ❌ | ❌ |
| My Event Passes (QR) | ✅ | ✅ | ✅ |
| Browse Events + countdown | ✅ | ✅ | ✅ |
