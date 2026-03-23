# CEMS Navigation Guide – All Links Connected

## Entry Points
- **landing.html** – Main home; links to Browse Events, Register, Sign In, Organizer Portal, Campus Home
- **login.html** – Student / Admin / Organizer login with role-based redirect
- **organizer_login.html** – Organizer login → organizer_dashboard

## User Flow by Role

### Student
1. **landing.html** → Browse Events / Register / Sign In  
2. **register-event.html** – Browse and register for events (login required)  
3. **student_dashboard.html** – My events, My Event Passes, Browse Events, Contact Organizers, Notifications  
4. **features/qr/passes.html** – View QR passes and download certificates  

### Admin
1. **landing.html** → Sign In (Admin)  
2. **admin_dashboard.html** – Events, Registrations, Scan QR, Browse Events, Issues, Organizers, Notifications, Fraud Alerts  
3. **features/qr/scanner.html** – Scan QR for attendance (Back → admin_dashboard)  

### Organizer
1. **landing.html** → Organizer Portal  
2. **organizer_dashboard.html** – Create Event, Scan QR, Browse Events, Issues, Notifications  
3. **features/qr/scanner.html** – Scan QR for attendance (Back → organizer_dashboard)  

## Shared Navigation
- **Logo (EduEvents)** – Links to landing on all dashboards  
- **Browse Events** – Available in dashboards and standalone pages  
- **Dashboard** – Role-based redirect (admin / organizer / student)  
- **Logout** – Clears token and goes to landing  
- **Home** – Links to landing  
- **Campus** – Links to home.html  

## Page-to-Page Links
| From | To |
|------|-----|
| landing | register-event, register, login, organizer_login, home |
| login | landing, register |
| register | landing, login |
| register-event | landing, Browse Events, Dashboard (by role), passes (after success) |
| student_dashboard | register-event, passes, contact_chart, notifications |
| admin_dashboard | college-events, register-event, scanner, issues, contact_chart, notifications |
| organizer_dashboard | register-event, scanner, issues, contact_chart, notifications |
| passes | student_dashboard, register-event |
| scanner | admin_dashboard / organizer_dashboard (by role) |
| contact_chart, notifications, issues | Back to dashboard (by role), landing, register-event |
