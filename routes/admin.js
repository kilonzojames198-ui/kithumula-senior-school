const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/setup');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');

// Two separate multer instances — no path guessing, completely explicit
const staffDir   = path.join(__dirname, '..', 'public', 'images', 'staff');
const studentDir = path.join(__dirname, '..', 'public', 'images', 'students');
fs.mkdirSync(staffDir,   { recursive: true });
fs.mkdirSync(studentDir, { recursive: true });

const uploadStaff = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, staffDir),
    filename:    (req, file, cb) => cb(null, `staff_${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadStudent = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, studentDir),
    filename:    (req, file, cb) => cb(null, `student_${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// AUTH
router.get('/login', redirectIfAuth, (req, res) => res.render('admin/login', { flash: req.flash() }));
router.post('/login', redirectIfAuth, (req, res) => {
  const { email, password } = req.body;
  const user = db.get('SELECT * FROM admin_users WHERE email=?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    req.flash('error', 'Invalid email or password.');
    return res.redirect('/admin/login');
  }
  req.session.adminId = user.id;
  req.session.adminName = user.name;
  req.flash('success', `Welcome back, ${user.name}!`);
  res.redirect('/admin/dashboard');
});
router.post('/logout', requireAuth, (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

// DASHBOARD
router.get('/dashboard', requireAuth, (req, res) => {
  const stats = {
    staff:          db.get('SELECT COUNT(*) as c FROM staff WHERE is_active=1').c,
    students:       db.get('SELECT COUNT(*) as c FROM students WHERE is_active=1').c,
    classes:        db.get('SELECT COUNT(*) as c FROM classes').c,
    enquiries:      db.get("SELECT COUNT(*) as c FROM enrolment_enquiries WHERE status='new'").c,
  };
  const recentEnquiries = db.all('SELECT * FROM enrolment_enquiries ORDER BY created_at DESC LIMIT 5');
  res.render('admin/dashboard', { stats, recentEnquiries, adminName: req.session.adminName, flash: req.flash() });
});

// ─── STAFF ──────────────────────────────────────────────────────────────────
router.get('/staff', requireAuth, (req, res) => {
  const staff = db.all('SELECT * FROM staff ORDER BY created_at DESC');
  res.render('admin/staff', { staff, adminName: req.session.adminName, flash: req.flash() });
});
router.get('/staff/new', requireAuth, (req, res) =>
  res.render('admin/staff-form', { staff: null, adminName: req.session.adminName, flash: req.flash() }));

router.post('/staff', requireAuth, uploadStaff.single('photo'), (req, res) => {
  const { name, staff_number, id_number, role, department, email, phone, bio, is_active, is_teacher } = req.body;
  const photo = req.file ? `/images/staff/${req.file.filename}` : null;
  try {
    db.run('INSERT INTO staff (name,staff_number,id_number,role,department,email,phone,bio,photo,is_active,is_teacher) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [name, staff_number.trim(), id_number.trim(), role, department, email, phone||null, bio||null, photo, is_active?1:0, is_teacher?1:0]);
    req.flash('success', `${name} added. Login: Staff# ${staff_number}, Password: ${id_number}`);
  } catch(e) { req.flash('error', 'Staff number or email already exists.'); }
  res.redirect('/admin/staff');
});

router.get('/staff/:id/edit', requireAuth, (req, res) => {
  const staff = db.get('SELECT * FROM staff WHERE id=?', [req.params.id]);
  if (!staff) return res.redirect('/admin/staff');
  res.render('admin/staff-form', { staff, adminName: req.session.adminName, flash: req.flash() });
});

router.post('/staff/:id', requireAuth, uploadStaff.single('photo'), (req, res) => {
  const { name, staff_number, id_number, role, department, email, phone, bio, is_active, is_teacher, _method } = req.body;
  if (_method === 'DELETE') {
    db.run('DELETE FROM staff WHERE id=?', [req.params.id]);
    req.flash('success', 'Staff removed.');
    return res.redirect('/admin/staff');
  }
  const current = db.get('SELECT photo FROM staff WHERE id=?', [req.params.id]);
  const photo = req.file ? `/images/staff/${req.file.filename}` : current?.photo;
  db.run(`UPDATE staff SET name=?,staff_number=?,id_number=?,role=?,department=?,email=?,phone=?,bio=?,photo=?,is_active=?,is_teacher=?,updated_at=datetime('now') WHERE id=?`,
    [name, staff_number.trim(), id_number.trim(), role, department, email, phone||null, bio||null, photo, is_active?1:0, is_teacher?1:0, req.params.id]);
  req.flash('success', `${name} updated.`);
  res.redirect('/admin/staff');
});

// ─── CLASSES ────────────────────────────────────────────────────────────────
router.get('/classes', requireAuth, (req, res) => {
  const classes = db.all(`
    SELECT c.*, s.name as teacher_name,
      (SELECT COUNT(*) FROM students st WHERE st.class_id=c.id AND st.is_active=1) as student_count
    FROM classes c LEFT JOIN staff s ON c.class_teacher_id=s.id ORDER BY c.grade, c.stream
  `);
  const teachers = db.all("SELECT id,name,staff_number FROM staff WHERE is_active=1 ORDER BY name");
  res.render('admin/classes', { classes, teachers, adminName: req.session.adminName, flash: req.flash() });
});

router.post('/classes', requireAuth, (req, res) => {
  const { name, grade, stream, class_teacher_id, academic_year } = req.body;
  try {
    db.run('INSERT INTO classes (name,grade,stream,class_teacher_id,academic_year) VALUES (?,?,?,?,?)',
      [name, grade, stream, class_teacher_id||null, academic_year||'2026']);
    req.flash('success', `Class ${name} created.`);
  } catch(e) { req.flash('error', 'Class name already exists.'); }
  res.redirect('/admin/classes');
});

router.post('/classes/:id/delete', requireAuth, (req, res) => {
  db.run('DELETE FROM classes WHERE id=?', [req.params.id]);
  req.flash('success', 'Class deleted.');
  res.redirect('/admin/classes');
});

// ─── STUDENTS ───────────────────────────────────────────────────────────────
router.get('/students', requireAuth, (req, res) => {
  const classId = req.query.class_id || '';
  const classes = db.all('SELECT * FROM classes ORDER BY grade, stream');
  const students = classId
    ? db.all('SELECT st.*,c.name as class_name FROM students st JOIN classes c ON st.class_id=c.id WHERE st.class_id=? ORDER BY st.name', [classId])
    : db.all('SELECT st.*,c.name as class_name FROM students st JOIN classes c ON st.class_id=c.id ORDER BY c.grade,c.stream,st.name');
  res.render('admin/students', { students, classes, classId, adminName: req.session.adminName, flash: req.flash() });
});

router.post('/students', requireAuth, (req, res) => {
  // We handle the photo manually after reading the body first
  uploadStudent.single('photo')(req, res, function(uploadErr) {
    if (uploadErr) {
      console.error('Photo upload error:', uploadErr.message);
      // Non-fatal — continue without photo
    }

    const name      = (req.body.name      || '').trim();
    const class_id  = (req.body.class_id  || '').trim();
    const gender    = (req.body.gender    || '').trim() || null;
    const dob       = (req.body.dob       || '').trim() || null;
    const parent_name  = (req.body.parent_name  || '').trim() || null;
    const parent_phone = (req.body.parent_phone || '').trim() || null;
    const photo     = req.file ? `/images/students/${req.file.filename}` : null;

    if (!name) {
      req.flash('error', 'Student name is required.');
      return res.redirect('/admin/students' + (class_id ? `?class_id=${class_id}` : ''));
    }
    if (!class_id) {
      req.flash('error', 'Please select a class.');
      return res.redirect('/admin/students');
    }

    // Auto-generate admission number
    const year   = new Date().getFullYear();
    const prefix = `KSS${year}`;
    let seq = 1;
    try {
      const last = db.get(
        `SELECT adm_number FROM students WHERE adm_number LIKE ? ORDER BY adm_number DESC LIMIT 1`,
        [`${prefix}%`]
      );
      if (last && last.adm_number) {
        const n = parseInt(last.adm_number.slice(prefix.length), 10);
        if (!isNaN(n)) seq = n + 1;
      }
    } catch(e) { /* use seq=1 */ }

    const adm_number = `${prefix}${String(seq).padStart(3, '0')}`;

    try {
      db.run(
        'INSERT INTO students (name, adm_number, class_id, gender, dob, parent_name, parent_phone, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, adm_number, parseInt(class_id, 10), gender, dob, parent_name, parent_phone, photo]
      );
      req.flash('success', `✓ ${name} enrolled. Admission Number: ${adm_number}`);
    } catch(e) {
      console.error('Enrol error:', e.message);
      req.flash('error', `Enrolment failed: ${e.message}`);
    }

    res.redirect('/admin/students' + (class_id ? `?class_id=${class_id}` : ''));
  });
});

router.post('/students/:id/delete', requireAuth, (req, res) => {
  db.run('UPDATE students SET is_active=0 WHERE id=?', [req.params.id]);
  req.flash('success', 'Student removed.');
  res.redirect('/admin/students');
});

// ─── SUBJECT ASSIGNMENTS ────────────────────────────────────────────────────
router.get('/assignments', requireAuth, (req, res) => {
  const assignments = db.all(`
    SELECT sa.*, st.name as teacher_name, st.staff_number,
           s.name as subject_name, s.code, c.name as class_name
    FROM subject_assignments sa
    JOIN staff st ON sa.staff_id=st.id
    JOIN subjects s ON sa.subject_id=s.id
    JOIN classes c ON sa.class_id=c.id
    ORDER BY c.grade, c.name, s.name
  `);
  const teachers = db.all("SELECT id,name,staff_number FROM staff WHERE is_teacher=1 AND is_active=1 ORDER BY name");
  const subjects = db.all('SELECT * FROM subjects ORDER BY is_core DESC, name');
  const classes = db.all('SELECT * FROM classes ORDER BY grade, stream');
  res.render('admin/assignments', { assignments, teachers, subjects, classes, adminName: req.session.adminName, flash: req.flash() });
});

router.post('/assignments', requireAuth, (req, res) => {
  const { staff_id, subject_id, class_id, academic_year } = req.body;
  try {
    db.run('INSERT INTO subject_assignments (staff_id,subject_id,class_id,academic_year) VALUES (?,?,?,?)',
      [staff_id, subject_id, class_id, academic_year||'2026']);
    req.flash('success', 'Assignment created.');
  } catch(e) { req.flash('error', 'This assignment already exists.'); }
  res.redirect('/admin/assignments');
});

router.post('/assignments/:id/delete', requireAuth, (req, res) => {
  db.run('DELETE FROM subject_assignments WHERE id=?', [req.params.id]);
  req.flash('success', 'Assignment removed.');
  res.redirect('/admin/assignments');
});

// ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────────
router.get('/announcements', requireAuth, (req, res) => {
  const announcements = db.all('SELECT * FROM announcements ORDER BY created_at DESC');
  res.render('admin/announcements', { announcements, adminName: req.session.adminName, flash: req.flash() });
});
router.post('/announcements', requireAuth, (req, res) => {
  const { title, body, category, is_active } = req.body;
  db.run('INSERT INTO announcements (title,body,category,is_active,created_by) VALUES (?,?,?,?,?)',
    [title, body, category||'general', is_active?1:0, req.session.adminId]);
  req.flash('success', 'Published.');
  res.redirect('/admin/announcements');
});
router.post('/announcements/:id', requireAuth, (req, res) => {
  const { title, body, category, is_active, _method } = req.body;
  if (_method === 'DELETE') {
    db.run('DELETE FROM announcements WHERE id=?', [req.params.id]);
    req.flash('success', 'Deleted.');
    return res.redirect('/admin/announcements');
  }
  db.run('UPDATE announcements SET title=?,body=?,category=?,is_active=? WHERE id=?',
    [title, body, category, is_active?1:0, req.params.id]);
  res.redirect('/admin/announcements');
});

// ─── ENQUIRIES ──────────────────────────────────────────────────────────────
router.get('/enquiries', requireAuth, (req, res) => {
  const filter = req.query.status || 'all';
  const enquiries = filter === 'all'
    ? db.all('SELECT * FROM enrolment_enquiries ORDER BY created_at DESC')
    : db.all('SELECT * FROM enrolment_enquiries WHERE status=? ORDER BY created_at DESC', [filter]);
  res.render('admin/enquiries', { enquiries, filter, adminName: req.session.adminName, flash: req.flash() });
});
router.post('/enquiries/:id/status', requireAuth, (req, res) => {
  db.run('UPDATE enrolment_enquiries SET status=? WHERE id=?', [req.body.status, req.params.id]);
  res.redirect('/admin/enquiries');
});

module.exports = router;
