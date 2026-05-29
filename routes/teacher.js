const express = require('express');
const router = express.Router();
const db = require('../db/setup');
const { aggregateStudentResults } = require('../utils/grades');
const { generateClassReportPDF, generateClassSummaryPDF, generateSingleStudentPDF } = require('../utils/pdf');

function requireTeacher(req, res, next) {
  if (req.session && req.session.teacherId) return next();
  req.flash('error', 'Please log in.');
  res.redirect('/teacher/login');
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.teacherId) return res.redirect('/teacher/dashboard');
  res.render('teacher/login', { flash: req.flash() });
});

router.post('/login', (req, res) => {
  const { staff_number, id_number } = req.body;
  const teacher = db.get('SELECT * FROM staff WHERE staff_number=? AND id_number=? AND is_active=1', [staff_number.trim(), id_number.trim()]);
  if (!teacher) {
    req.flash('error', 'Invalid Staff Number or ID Number.');
    return res.redirect('/teacher/login');
  }
  req.session.teacherId = teacher.id;
  req.session.teacherName = teacher.name;
  req.session.teacherNumber = teacher.staff_number;
  req.flash('success', `Welcome, ${teacher.name}!`);
  res.redirect('/teacher/dashboard');
});

router.post('/logout', (req, res) => { req.session.destroy(); res.redirect('/teacher/login'); });

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
router.get('/dashboard', requireTeacher, (req, res) => {
  const assignments = db.all(`
    SELECT sa.*, s.name as subject_name, s.code, c.name as class_name, c.grade
    FROM subject_assignments sa
    JOIN subjects s ON sa.subject_id = s.id
    JOIN classes c ON sa.class_id = c.id
    WHERE sa.staff_id = ?
    ORDER BY c.grade, c.name
  `, [req.session.teacherId]);

  // Count marks entered per assignment
  const withCounts = assignments.map(a => {
    const entered = db.get('SELECT COUNT(*) as c FROM marks WHERE subject_id=? AND class_id=? AND entered_by=?',
      [a.subject_id, a.class_id, req.session.teacherId]);
    const total = db.get('SELECT COUNT(*) as c FROM students WHERE class_id=? AND is_active=1', [a.class_id]);
    return { ...a, entered: entered?.c || 0, total: total?.c || 0 };
  });

  // Class teacher check
  const myClass = db.get('SELECT * FROM classes WHERE class_teacher_id=?', [req.session.teacherId]);

  res.render('teacher/dashboard', {
    assignments: withCounts,
    teacherName: req.session.teacherName,
    myClass,
    flash: req.flash()
  });
});

// ─── MARKS ENTRY ───────────────────────────────────────────────────────────
router.get('/marks/:subjectId/:classId', requireTeacher, (req, res) => {
  const { subjectId, classId } = req.params;
  const examTypeId = req.query.exam_type || '';

  // Verify assignment
  const assignment = db.get(`
    SELECT sa.*, s.name as subject_name, c.name as class_name
    FROM subject_assignments sa
    JOIN subjects s ON sa.subject_id = s.id
    JOIN classes c ON sa.class_id = c.id
    WHERE sa.staff_id=? AND sa.subject_id=? AND sa.class_id=?
  `, [req.session.teacherId, subjectId, classId]);

  if (!assignment) {
    req.flash('error', 'You are not assigned to this subject/class.');
    return res.redirect('/teacher/dashboard');
  }

  const students = db.all('SELECT * FROM students WHERE class_id=? AND is_active=1 ORDER BY name', [classId]);
  const examTypes = db.all('SELECT * FROM exam_types ORDER BY id');

  let existingMarks = [];
  if (examTypeId) {
    existingMarks = db.all('SELECT * FROM marks WHERE subject_id=? AND class_id=? AND exam_type_id=?',
      [subjectId, classId, examTypeId]);
  }

  const marksMap = {};
  existingMarks.forEach(m => { marksMap[m.student_id] = m; });

  const selectedExamType = examTypes.find(e => e.id == examTypeId);

  res.render('teacher/marks', {
    assignment, students, examTypes, examTypeId, marksMap,
    selectedExamType,
    teacherName: req.session.teacherName,
    flash: req.flash()
  });
});

router.post('/marks/:subjectId/:classId', requireTeacher, (req, res) => {
  const { subjectId, classId } = req.params;
  const { exam_type_id, max_marks } = req.body;
  const max = parseFloat(max_marks) || 100;

  // The form uses name="marks[s_STUDENTID]" (string prefix) to prevent qs
  // from misinterpreting numeric keys as array indices.
  // req.body.marks is always a plain object { s_1: '75', s_2: '88', ... }
  const marksObj = req.body.marks || {};

  let saved = 0, skipped = 0;

  Object.entries(marksObj).forEach(([key, val]) => {
    // Strip the 's_' prefix to get the real student ID
    const studentId = key.startsWith('s_') ? key.slice(2) : key;
    const v = parseFloat(val);
    if (val === '' || val === null || val === undefined || isNaN(v)) return;
    if (v < 0 || v > max) { skipped++; return; }
    try {
      const existing = db.get(
        'SELECT id FROM marks WHERE student_id=? AND subject_id=? AND exam_type_id=?',
        [studentId, subjectId, exam_type_id]
      );
      if (existing) {
        db.run(
          'UPDATE marks SET marks_obtained=?, max_marks=?, entered_by=?, entered_at=datetime("now") WHERE id=?',
          [v, max, req.session.teacherId, existing.id]
        );
      } else {
        db.run(
          'INSERT INTO marks (student_id,subject_id,exam_type_id,class_id,marks_obtained,max_marks,entered_by) VALUES (?,?,?,?,?,?,?)',
          [studentId, subjectId, exam_type_id, classId, v, max, req.session.teacherId]
        );
      }
      saved++;
    } catch(e) {
      console.error('Mark save error student', studentId, ':', e.message);
      skipped++;
    }
  });

  req.flash('success', `✓ Saved ${saved} mark${saved !== 1 ? 's' : ''}.${skipped ? ` (${skipped} skipped — out of range)` : ''}`);
  res.redirect(`/teacher/marks/${subjectId}/${classId}?exam_type=${exam_type_id}`);
});

// ─── VIEW CLASS RESULTS ─────────────────────────────────────────────────────
router.get('/results/:classId', requireTeacher, (req, res) => {
  const { classId } = req.params;
  const classInfo = db.get('SELECT * FROM classes WHERE id=?', [classId]);
  if (!classInfo) return res.redirect('/teacher/dashboard');

  const students = db.all('SELECT * FROM students WHERE class_id=? AND is_active=1 ORDER BY name', [classId]);
  const subjects = db.all(`
    SELECT DISTINCT s.* FROM subjects s
    JOIN subject_assignments sa ON s.id = sa.subject_id
    WHERE sa.class_id=?
    ORDER BY s.is_core DESC, s.name
  `, [classId]);
  const examTypes = db.all('SELECT * FROM exam_types ORDER BY id');

  // Build results for every student
  const allResults = {};
  students.forEach(student => {
    const marksBySubject = {};
    subjects.forEach(subj => {
      const mks = db.all(`
        SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id
        FROM marks m JOIN exam_types et ON m.exam_type_id = et.id
        WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?
      `, [student.id, subj.id, classId]);
      if (mks.length) marksBySubject[subj.id] = mks;
    });
    allResults[student.id] = aggregateStudentResults(marksBySubject, subjects);
  });

  // Rank students
  const ranked = students.map(s => ({ ...s, result: allResults[s.id] }))
    .sort((a, b) => b.result.meanPoints - a.result.meanPoints);
  ranked.forEach((s, i) => { allResults[s.id].rank = i + 1; });

  res.render('teacher/results', {
    classInfo, students: ranked, subjects, examTypes,
    allResults, teacherName: req.session.teacherName, flash: req.flash()
  });
});

// ─── PDF DOWNLOADS ──────────────────────────────────────────────────────────
router.get('/pdf/reports/:classId', requireTeacher, (req, res) => {
  const { classId } = req.params;
  const term = req.query.term || 'Term 1';
  const year = req.query.year || '2026';

  const classInfo = db.get('SELECT * FROM classes WHERE id=?', [classId]);
  const students = db.all('SELECT * FROM students WHERE class_id=? AND is_active=1 ORDER BY name', [classId]);
  const subjects = db.all(`
    SELECT DISTINCT s.* FROM subjects s
    JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=?
    ORDER BY s.is_core DESC, s.name
  `, [classId]);
  const examTypes = db.all('SELECT * FROM exam_types ORDER BY id');

  const allResults = {};
  students.forEach(student => {
    const marksBySubject = {};
    subjects.forEach(subj => {
      const mks = db.all(`
        SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id
        FROM marks m JOIN exam_types et ON m.exam_type_id=et.id
        WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?
      `, [student.id, subj.id, classId]);
      if (mks.length) marksBySubject[subj.id] = mks;
    });
    allResults[student.id] = aggregateStudentResults(marksBySubject, subjects);
  });

  generateClassReportPDF(res, students, classInfo, allResults, examTypes, term, year, false);
});

// ─── SHARED DATA BUILDER ────────────────────────────────────────────────────
function buildClassData(classId) {
  const classInfo = db.get('SELECT * FROM classes WHERE id=?', [classId]);
  const students  = db.all('SELECT * FROM students WHERE class_id=? AND is_active=1 ORDER BY name', [classId]);
  const subjects  = db.all('SELECT DISTINCT s.* FROM subjects s JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=? ORDER BY s.is_core DESC, s.name', [classId]);
  const examTypes = db.all('SELECT * FROM exam_types ORDER BY id');
  const allResults = {};
  students.forEach(student => {
    const mbs = {};
    subjects.forEach(subj => {
      const mks = db.all('SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?', [student.id, subj.id, classId]);
      if (mks.length) mbs[subj.id] = mks;
    });
    allResults[student.id] = aggregateStudentResults(mbs, subjects);
  });
  return { classInfo, students, subjects, examTypes, allResults };
}

// ─── REPORTS: INLINE VIEW ───────────────────────────────────────────────────
router.get('/pdf/view/reports/:classId', requireTeacher, (req, res) => {
  const { classId } = req.params;
  const term = req.query.term || 'Term 1', year = req.query.year || '2026';
  const { classInfo, students, examTypes, allResults } = buildClassData(classId);
  generateClassReportPDF(res, students, classInfo, allResults, examTypes, term, year, true);
});

// ─── SUMMARY: DOWNLOAD ──────────────────────────────────────────────────────
router.get('/pdf/summary/:classId', requireTeacher, (req, res) => {
  const { classId } = req.params;
  const term = req.query.term || 'Term 1', year = req.query.year || '2026';
  const { classInfo, students, subjects, examTypes, allResults } = buildClassData(classId);
  generateClassSummaryPDF(res, students, classInfo, allResults, subjects, examTypes, term, year, false);
});

// ─── SUMMARY: INLINE VIEW ───────────────────────────────────────────────────
router.get('/pdf/view/summary/:classId', requireTeacher, (req, res) => {
  const { classId } = req.params;
  const term = req.query.term || 'Term 1', year = req.query.year || '2026';
  const { classInfo, students, subjects, examTypes, allResults } = buildClassData(classId);
  generateClassSummaryPDF(res, students, classInfo, allResults, subjects, examTypes, term, year, true);
});

module.exports = router;

// ─── REPORTS PAGE ───────────────────────────────────────────────────────────
router.get('/reports', requireTeacher, (req, res) => {
  // Get all classes this teacher has assignments in OR is class teacher of
  const classes = db.all(`
    SELECT DISTINCT c.*,
      (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.is_active=1) as student_count,
      (SELECT COUNT(*) FROM marks m WHERE m.class_id=c.id) as marks_count
    FROM classes c
    LEFT JOIN subject_assignments sa ON sa.class_id=c.id AND sa.staff_id=?
    WHERE sa.staff_id=? OR c.class_teacher_id=?
    ORDER BY c.grade, c.stream
  `, [req.session.teacherId, req.session.teacherId, req.session.teacherId]);

  const examTypes = db.all('SELECT DISTINCT term FROM exam_types ORDER BY id');
  const years = ['2026', '2025'];

  res.render('teacher/reports', {
    classes, examTypes, years,
    teacherName: req.session.teacherName,
    myClass: db.get('SELECT * FROM classes WHERE class_teacher_id=?', [req.session.teacherId]),
    flash: req.flash()
  });
});

// ─── INLINE PDF VIEW (single student) ──────────────────────────────────────
router.get('/pdf/view/:studentId', requireTeacher, (req, res) => {
  const student = db.get('SELECT s.*, c.name as class_name, c.id as class_id, c.academic_year FROM students s JOIN classes c ON s.class_id=c.id WHERE s.id=?', [req.params.studentId]);
  if (!student) return res.status(404).send('Student not found');
  const term = req.query.term || 'Term 1';
  const year = req.query.year || student.academic_year || '2026';
  const subjects = db.all('SELECT DISTINCT s.* FROM subjects s JOIN subject_assignments sa ON s.id=sa.subject_id WHERE sa.class_id=? ORDER BY s.is_core DESC, s.name', [student.class_id]);
  const examTypes = db.all('SELECT * FROM exam_types ORDER BY id');
  const marksBySubject = {};
  subjects.forEach(subj => {
    const mks = db.all('SELECT m.*, et.contribution, et.name as exam_name, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?', [student.id, subj.id, student.class_id]);
    if (mks.length) marksBySubject[subj.id] = mks;
  });
  const result = aggregateStudentResults(marksBySubject, subjects);
  const classStudents = db.all('SELECT id FROM students WHERE class_id=? AND is_active=1', [student.class_id]);
  let rank = 1;
  classStudents.forEach(cs => {
    if (cs.id === student.id) return;
    const mbs2 = {};
    subjects.forEach(subj => {
      const mks = db.all('SELECT m.*, et.contribution, et.id as exam_type_id FROM marks m JOIN exam_types et ON m.exam_type_id=et.id WHERE m.student_id=? AND m.subject_id=? AND m.class_id=?', [cs.id, subj.id, student.class_id]);
      if (mks.length) mbs2[subj.id] = mks;
    });
    if (aggregateStudentResults(mbs2, subjects).meanPoints > result.meanPoints) rank++;
  });
  generateSingleStudentPDF(res, student, { name: student.class_name }, result, examTypes, term, year, rank, classStudents.length, true);
});
