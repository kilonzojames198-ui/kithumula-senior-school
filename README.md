# Kithumula Senior School — Full Node.js System

A complete school website + academic management system built with Node.js/Express.

---

## Quick Start

```bash
unzip kithumula-nodejs.zip
cd kithumula
npm install
npm start
```

Server runs at **http://localhost:3000**

---

## Login Portals

| Portal | URL | Credentials |
|--------|-----|-------------|
| Admin | `/admin/login` | `admin@kithumula.sc.ke` / `Admin@2026` |
| Teacher | `/teacher/login` | Staff Number + ID Number (e.g. `KSS003` / `34567890`) |

> ⚠️ Change the default admin password after first login.

---

## Admin Panel — Full Feature List

### Staff Management (`/admin/staff`)
- Add staff with **Staff Number** and **ID Number** (ID number = their login password)
- Mark staff as teachers (gives portal access) or non-teaching
- Upload staff photos, set department, role, bio
- Toggle active/inactive (controls public directory listing)

### Classes (`/admin/classes`)
- Create classes: Grade 10A, 10B, 11A, 12A etc.
- Assign a class teacher to each class

### Students (`/admin/students`)
- Enrol students with admission number, class, gender, parent contacts
- Filter view by class
- Soft-delete (deactivate) students

### Subject Assignments (`/admin/assignments`)
- Assign which teacher teaches which subject in which class
- Teachers only see their own assigned subjects in the teacher portal
- Supports core subjects (English, Kiswahili, Maths, PE, Life Skills, CSL)
  and pathway subjects (STEM, Social Sciences, Arts & Sports)

### Announcements (`/admin/announcements`)
- Post notices that appear live on the school home page
- Toggle visible/hidden, delete, categorise (General, Academic, Event)

### Enquiries (`/admin/enquiries`)
- View all enrolment enquiries from the website contact form
- Update status: New → Contacted → Enrolled → Closed
- Filter by status

---

## Teacher Portal — Full Feature List

### Dashboard (`/teacher/dashboard`)
- See all assigned subjects with progress bar showing marks entered
- Quick link to Reports & PDFs

### Enter Marks (`/teacher/marks/:subjectId/:classId`)
- Select exam type: CAT 1 (out of 30), CAT 2 (out of 30), End Term (out of 100)
- Enter marks per student — percentage and CBC grade calculate **live in browser**
- Marks saved individually; re-open anytime to update
- Class average shown at the bottom

### View Results (`/teacher/results/:classId`)
- Full ranked class table (highest to lowest mean points)
- Per-subject scores for every student
- Grade distribution summary (EE / ME / AE / BE counts + percentages)
- Subject analysis: average, highest, lowest, pass rate, grade breakdown

### Reports & PDFs (`/teacher/reports`)  ← **Central hub for all PDFs**
- Lists every class the teacher is assigned to or is class teacher of
- Select Term (Term 1/2/3) and Year before downloading
- **Individual Report Forms (PDF)** — one A4 page per student, sorted by rank:
  - Student info, class, term, rank
  - All subjects with CAT 1, CAT 2, End Term marks
  - Weighted total percentage and CBC grade per subject
  - Overall grade and mean points
  - Class teacher comment/signature line
- **Class Performance Summary (PDF)** — landscape A4:
  - All students ranked in a single table
  - Per-subject scores colour-coded by grade
  - Subject statistics footer (avg, high, low, pass rate per subject)

---

## Grading System (CBC)

| Grade | Label | Range | Points |
|-------|-------|-------|--------|
| EE | Exceeds Expectation | 80–100% | 4 |
| ME | Meets Expectation | 65–79% | 3 |
| AE | Approaches Expectation | 50–64% | 2 |
| BE | Below Expectation | < 50% | 1 |

**Weighted calculation:**
- CAT 1 contributes 30%
- CAT 2 contributes 30%  
- End Term contributes 40%
- Mean Points = average of all subject points
- Overall Grade derived from Mean Points

---

## Project Structure

```
kithumula/
├── server.js                  ← Entry point (port 3000)
├── package.json
├── db/
│   └── setup.js               ← SQLite init, all tables, seed data
├── middleware/
│   └── auth.js                ← Session guards
├── routes/
│   ├── public.js              ← Home, /staff, enquiry form POST
│   ├── admin.js               ← All admin CRUD routes
│   └── teacher.js             ← Teacher login, marks, results, PDF routes
├── utils/
│   ├── grades.js              ← CBC grading calculations
│   └── pdf.js                 ← PDFKit report & summary generators
├── views/
│   ├── index.ejs              ← School home page
│   ├── staff.ejs              ← Public staff directory
│   ├── 404.ejs
│   ├── partials/              ← head, nav, footer
│   ├── admin/                 ← login, dashboard, staff, classes,
│   │                             students, assignments, announcements, enquiries
│   └── teacher/               ← login, nav, dashboard, marks,
│                                 results, reports
└── public/
    ├── css/main.css
    └── images/                ← Slide images, logo, staff photos (uploaded)
```

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite via sql.js (zero-install, file-based at `db/school.db`)
- **Templates:** EJS
- **Auth:** express-session (admin: bcrypt password; teacher: staff number + ID number)
- **PDF:** PDFKit
- **File uploads:** Multer (staff photos → `public/images/staff/`)

## Environment Variables (production)

```
PORT=3000
SESSION_SECRET=your-very-secret-key-change-this
```
