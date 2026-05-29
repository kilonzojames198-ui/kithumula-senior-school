const express = require('express');
const router = express.Router();
const db = require('../db/setup');

router.get('/', (req, res) => {
  const announcements = db.all(
    'SELECT * FROM announcements WHERE is_active=1 ORDER BY created_at DESC LIMIT 3'
  );
  res.render('index', { announcements, flash: req.flash() });
});

router.get('/staff', (req, res) => {
  const staff = db.all(`
    SELECT * FROM staff WHERE is_active=1
    ORDER BY CASE department
      WHEN 'Administration' THEN 1 WHEN 'STEM' THEN 2
      WHEN 'Social Sciences' THEN 3 WHEN 'Arts & Sports' THEN 4 ELSE 5
    END, name
  `);
  res.render('staff', { staff, flash: req.flash() });
});

router.post('/enquire', (req, res) => {
  const { student_name, parent_name, phone, email, grade, message } = req.body;
  if (!student_name || !parent_name || !phone || !grade) {
    req.flash('error', 'Please fill in all required fields.');
    return res.redirect('/#enrol');
  }
  db.run(
    'INSERT INTO enrolment_enquiries (student_name,parent_name,phone,email,grade,message) VALUES (?,?,?,?,?,?)',
    [student_name, parent_name, phone, email||null, grade, message||null]
  );
  req.flash('success', 'Thank you! We will be in touch shortly.');
  res.redirect('/#enrol');
});

module.exports = router;

// Student results lookup
router.post('/results/lookup', (req, res) => {
  const { adm_number, name } = req.body;
  if (!adm_number || !name) {
    req.flash('lookup_error', 'Please enter both your admission number and name.');
    return res.redirect('/#results-lookup');
  }

  // Find student — match adm_number and partial name (case-insensitive)
  const student = db.get(
    "SELECT s.*, c.name as class_name, c.id as class_id FROM students s JOIN classes c ON s.class_id=c.id WHERE LOWER(s.adm_number)=LOWER(?) AND is_active=1",
    [adm_number.trim()]
  );

  if (!student) {
    req.flash('lookup_error', 'No student found with that admission number.');
    return res.redirect('/#results-lookup');
  }

  // Loose name match — at least one word must match
  const inputWords = name.trim().toLowerCase().split(/\s+/);
  const storedWords = student.name.toLowerCase().split(/\s+/);
  const match = inputWords.some(w => w.length > 1 && storedWords.some(sw => sw.includes(w)));
  if (!match) {
    req.flash('lookup_error', 'Name does not match our records. Please check and try again.');
    return res.redirect('/#results-lookup');
  }

  // Store verified student id in session for the results page
  req.session.lookupStudentId = student.id;
  res.redirect('/results/student/' + student.id);
});

router.get('/results/student/:id', (req, res) => {
  // Must have come through lookup
  if (!req.session.lookupStudentId || req.session.lookupStudentId != req.params.id) {
    req.flash('lookup_error', 'Please use the form below to look up your results.');
    return res.redirect('/#results-lookup');
  }

  const { aggregateStudentResults } = require('../utils/grades');
  const db2 = require('../db/setup');

  const student = db2.get(
    'SELECT s.*, c.name as class_name, c.id as class_id, c.academic_year FROM students s JOIN classes c ON s.class_id=c.id WHERE s.id=?',
    [req.params.id]
  );
  if (!student) return res.redirect('/#results-lookup');

  const subjects = db2.all(
    'SELECT DISTINCT s.* FROM subjects s JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=? ORDER BY s.is_core DESC, s.name',
    [student.class_id]
  );
  const examTypes = db2.all('SELECT * FROM exam_types ORDER BY id');

  const marksBySubject = {};
  subjects.forEach(subj => {
    const mks = db2.all(
      'SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?',
      [student.id, subj.id, student.class_id]
    );
    if (mks.length) marksBySubject[subj.id] = mks;
  });

  const result = aggregateStudentResults(marksBySubject, subjects);

  // Calculate rank in class
  const classStudents = db2.all('SELECT id FROM students WHERE class_id=? AND is_active=1', [student.class_id]);
  let rank = 1;
  classStudents.forEach(cs => {
    if (cs.id === student.id) return;
    const mbs2 = {};
    subjects.forEach(subj => {
      const mks = db2.all('SELECT m.*, et.contribution, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?',
        [cs.id, subj.id, student.class_id]);
      if (mks.length) mbs2[subj.id] = mks;
    });
    const r2 = aggregateStudentResults(mbs2, subjects);
    if (r2.meanPoints > result.meanPoints) rank++;
  });

  const hasMarks = result.subjectCount > 0;

  res.render('student-results', {
    student, result, subjects, examTypes, rank,
    classSize: classStudents.length,
    hasMarks,
    flash: req.flash()
  });
});

// Student PDF download — only if session verified
router.get('/results/student/:id/pdf', (req, res) => {
  if (!req.session.lookupStudentId || req.session.lookupStudentId != req.params.id) {
    return res.redirect('/#results-lookup');
  }

  const { aggregateStudentResults } = require('../utils/grades');
  const { generateSingleStudentPDF } = require('../utils/pdf');
  const db2 = require('../db/setup');

  const student = db2.get(
    'SELECT s.*, c.name as class_name, c.id as class_id, c.academic_year FROM students s JOIN classes c ON s.class_id=c.id WHERE s.id=?',
    [req.params.id]
  );
  if (!student) return res.redirect('/#results-lookup');

  const subjects = db2.all(
    'SELECT DISTINCT s.* FROM subjects s JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=? ORDER BY s.is_core DESC, s.name',
    [student.class_id]
  );
  const examTypes = db2.all('SELECT * FROM exam_types ORDER BY id');

  const marksBySubject = {};
  subjects.forEach(subj => {
    const mks = db2.all('SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?',
      [student.id, subj.id, student.class_id]);
    if (mks.length) marksBySubject[subj.id] = mks;
  });

  const result = aggregateStudentResults(marksBySubject, subjects);

  const classStudents = db2.all('SELECT id FROM students WHERE class_id=? AND is_active=1', [student.class_id]);
  let rank = 1;
  classStudents.forEach(cs => {
    if (cs.id === student.id) return;
    const mbs2 = {};
    subjects.forEach(subj => {
      const mks = db2.all('SELECT m.*, et.contribution, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?',
        [cs.id, subj.id, student.class_id]);
      if (mks.length) mbs2[subj.id] = mks;
    });
    const r2 = aggregateStudentResults(mbs2, subjects);
    if (r2.meanPoints > result.meanPoints) rank++;
  });

  generateSingleStudentPDF(res, student, { name: student.class_name }, result, examTypes, 'Term 1', student.academic_year || '2026', rank, classStudents.length);
});

// Inline PDF view (for browser viewer)
router.get('/results/student/:id/view', (req, res) => {
  if (!req.session.lookupStudentId || req.session.lookupStudentId != req.params.id) {
    return res.redirect('/#results-lookup');
  }
  const { aggregateStudentResults } = require('../utils/grades');
  const { generateSingleStudentPDF } = require('../utils/pdf');
  const db2 = require('../db/setup');
  const student = db2.get('SELECT s.*, c.name as class_name, c.id as class_id, c.academic_year FROM students s JOIN classes c ON s.class_id=c.id WHERE s.id=?', [req.params.id]);
  if (!student) return res.redirect('/#results-lookup');
  const subjects = db2.all('SELECT DISTINCT s.* FROM subjects s JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=? ORDER BY s.is_core DESC, s.name', [student.class_id]);
  const examTypes = db2.all('SELECT * FROM exam_types ORDER BY id');
  const marksBySubject = {};
  subjects.forEach(subj => {
    const mks = db2.all('SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?', [student.id, subj.id, student.class_id]);
    if (mks.length) marksBySubject[subj.id] = mks;
  });
  const result = aggregateStudentResults(marksBySubject, subjects);
  const classStudents = db2.all('SELECT id FROM students WHERE class_id=? AND is_active=1', [student.class_id]);
  let rank = 1;
  classStudents.forEach(cs => {
    if (cs.id === student.id) return;
    const mbs2 = {};
    subjects.forEach(subj => {
      const mks = db2.all('SELECT m.*, et.contribution, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?', [cs.id, subj.id, student.class_id]);
      if (mks.length) mbs2[subj.id] = mks;
    });
    const r2 = aggregateStudentResults(mbs2, subjects);
    if (r2.meanPoints > result.meanPoints) rank++;
  });
  generateSingleStudentPDF(res, student, { name: student.class_name }, result, examTypes, 'Term 1', student.academic_year || '2026', rank, classStudents.length, true);
});
