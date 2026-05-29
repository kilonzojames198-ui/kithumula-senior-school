const initSqlJs = require('sql.js');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');

// Absolute path — always resolves to <project-root>/db/school.db
// regardless of cwd or how the module is required
const DB_PATH = path.resolve(__dirname, 'school.db');
console.log('[DB] path:', DB_PATH);

let db;

// ─── SAVE ──────────────────────────────────────────────────────────────────
function saveDb() {
  const data = db.export();           // Uint8Array
  fs.writeFileSync(DB_PATH, data);    // write raw bytes — no Buffer.from needed
}

// ─── INIT ──────────────────────────────────────────────────────────────────
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] loaded existing database (' + fileBuffer.length + ' bytes)');
  } else {
    db = new SQL.Database();
    console.log('[DB] created new database');
  }

  // ── SCHEMA ───────────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    role TEXT DEFAULT 'superadmin', created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    staff_number TEXT UNIQUE NOT NULL, id_number TEXT NOT NULL,
    role TEXT NOT NULL, department TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, phone TEXT, bio TEXT, photo TEXT,
    is_active INTEGER DEFAULT 1, is_teacher INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
    grade TEXT NOT NULL, stream TEXT NOT NULL,
    class_teacher_id INTEGER, academic_year TEXT NOT NULL DEFAULT '2026',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    adm_number TEXT UNIQUE NOT NULL, class_id INTEGER NOT NULL,
    gender TEXT, dob TEXT, parent_name TEXT, parent_phone TEXT,
    photo TEXT, class_teacher_comment TEXT, principal_comment TEXT,
    is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, department TEXT, is_core INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subject_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL, academic_year TEXT DEFAULT '2026',
    UNIQUE(staff_id, subject_id, class_id, academic_year)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exam_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    weight REAL DEFAULT 100, contribution REAL DEFAULT 100,
    academic_year TEXT DEFAULT '2026', term TEXT DEFAULT 'Term 1'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
    exam_type_id INTEGER NOT NULL, class_id INTEGER NOT NULL,
    marks_obtained REAL NOT NULL, max_marks REAL NOT NULL DEFAULT 100,
    entered_by INTEGER, entered_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, subject_id, exam_type_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    body TEXT NOT NULL, category TEXT DEFAULT 'general',
    is_active INTEGER DEFAULT 1, created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enrolment_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL, parent_name TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT, grade TEXT NOT NULL,
    message TEXT, status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── MIGRATIONS (add columns to existing DBs) ─────────────────────────────
  [
    ['students', 'photo',                 'TEXT'],
    ['students', 'class_teacher_comment', 'TEXT'],
    ['students', 'principal_comment',     'TEXT'],
  ].forEach(([table, col, type]) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); }
    catch(e) { /* column already exists */ }
  });

  // ── SEEDS (only if tables are empty) ─────────────────────────────────────
  _seedIfEmpty();

  // Save initial state
  saveDb();
  console.log('[DB] ready');
}

function _seedIfEmpty() {
  const adminCount = db.exec('SELECT COUNT(*) FROM admin_users')[0]?.values[0][0] || 0;
  if (adminCount === 0) {
    db.run('INSERT INTO admin_users (name,email,password,role) VALUES (?,?,?,?)',
      ['Administrator','admin@kithumula.sc.ke', bcrypt.hashSync('Admin@2026',10),'superadmin']);
    console.log('[DB] seeded: admin  →  admin@kithumula.sc.ke / Admin@2026');
  }

  const subjCount = db.exec('SELECT COUNT(*) FROM subjects')[0]?.values[0][0] || 0;
  if (subjCount === 0) {
    const subjects = [
      ['English','ENG',null,1],['Kiswahili','KIS',null,1],
      ['Mathematics','MAT',null,1],['Physical Education','PE',null,1],
      ['Life Skills','LS',null,1],['Community Service Learning','CSL',null,1],
      ['Physics','PHY','STEM',0],['Chemistry','CHEM','STEM',0],
      ['Biology','BIO','STEM',0],['Computer Science','CS','STEM',0],
      ['Agriculture','AGR','STEM',0],
      ['History & Citizenry','HIS','Social Sciences',0],
      ['Geography','GEO','Social Sciences',0],
      ['Business Studies','BUS','Social Sciences',0],['CRE','CRE','Social Sciences',0],
      ['Sports Science','SS','Arts & Sports',0],
      ['Music','MUS','Arts & Sports',0],['Fine Arts','ART','Arts & Sports',0],
    ];
    subjects.forEach(s => db.run('INSERT INTO subjects (name,code,department,is_core) VALUES (?,?,?,?)', s));
    console.log('[DB] seeded: subjects');
  }

  const examCount = db.exec('SELECT COUNT(*) FROM exam_types')[0]?.values[0][0] || 0;
  if (examCount === 0) {
    [['CAT 1',30,30],['CAT 2',30,30],['End Term',100,40]].forEach(([name,w,c]) =>
      db.run('INSERT INTO exam_types (name,weight,contribution,academic_year,term) VALUES (?,?,?,?,?)',
        [name,w,c,'2026','Term 1']));
    console.log('[DB] seeded: exam types');
  }

  const staffCount = db.exec('SELECT COUNT(*) FROM staff')[0]?.values[0][0] || 0;
  if (staffCount === 0) {
    const sample = [
      ['Mr. James Mutua','KSS001','12345678','Principal','Administration','principal@kithumula.sc.ke','0712000001',0],
      ['Mrs. Grace Ndeto','KSS002','23456789','Deputy Principal','Administration','deputy@kithumula.sc.ke','0712000002',0],
      ['Mr. Peter Kioko','KSS003','34567890','Teacher','STEM','stem@kithumula.sc.ke','0712000003',1],
      ['Ms. Ruth Mwende','KSS004','45678901','Teacher','Social Sciences','social@kithumula.sc.ke','0712000004',1],
      ['Mr. David Musyoka','KSS005','56789012','Teacher','Arts & Sports','arts@kithumula.sc.ke','0712000005',1],
    ];
    sample.forEach(s => db.run(
      'INSERT INTO staff (name,staff_number,id_number,role,department,email,phone,is_teacher) VALUES (?,?,?,?,?,?,?,?)', s));
    console.log('[DB] seeded: staff  →  login e.g. KSS003 / 34567890');
  }

  const classCount = db.exec('SELECT COUNT(*) FROM classes')[0]?.values[0][0] || 0;
  if (classCount === 0) {
    [['Grade 10A','Grade 10','A'],['Grade 10B','Grade 10','B'],
     ['Grade 11A','Grade 11','A'],['Grade 12A','Grade 12','A']].forEach(([n,g,s]) =>
      db.run('INSERT INTO classes (name,grade,stream,academic_year) VALUES (?,?,?,?)',[n,g,s,'2026']));
    const studentSeeds = [
      ['Alice Mutua','ADM001',1,'Female'],['Brian Kioko','ADM002',1,'Male'],
      ['Carol Ndeto','ADM003',1,'Female'],['David Mwende','ADM004',1,'Male'],
      ['Esther Musyoka','ADM005',1,'Female'],
    ];
    studentSeeds.forEach(s =>
      db.run('INSERT INTO students (name,adm_number,class_id,gender) VALUES (?,?,?,?)', s));
    console.log('[DB] seeded: classes & sample students');
  }
}

// ─── QUERY HELPERS ────────────────────────────────────────────────────────
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    if (params.length) stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (e) {
    console.error('[DB] all() error:', e.message, '\n  SQL:', sql.slice(0,120));
    return [];
  }
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDb();                          // persist every write immediately
    const li = db.exec('SELECT last_insert_rowid()');
    return {
      changes:         db.getRowsModified(),
      lastInsertRowid: Number(li[0]?.values[0][0] || 0),
    };
  } catch (e) {
    console.error('[DB] run() error:', e.message, '\n  SQL:', sql.slice(0,120));
    throw e;
  }
}

// ─── GRACEFUL SHUTDOWN SAVE ───────────────────────────────────────────────
// Belt-and-suspenders: save DB on any shutdown signal so no writes are lost
['exit','SIGINT','SIGTERM','SIGHUP'].forEach(sig => {
  process.on(sig, () => {
    if (db) {
      try { saveDb(); console.log('[DB] saved on', sig); } catch(e) {}
    }
  });
});

module.exports = { initDb, all, get, run };
