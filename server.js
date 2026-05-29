const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const { initDb } = require('./db/setup');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'kss-secret-2026',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(flash());
app.use((req, res, next) => { res.locals.session = req.session; next(); });

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));
app.use('/teacher', require('./routes/teacher'));
app.use((req, res) => res.status(404).render('404'));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🏫  Kithumula Senior School — Full System`);
    console.log(`🚀  http://localhost:${PORT}`);
    console.log(`🔐  Admin:    http://localhost:${PORT}/admin/login`);
    console.log(`        admin@kithumula.sc.ke / Admin@2026`);
    console.log(`👩‍🏫  Teacher:  http://localhost:${PORT}/teacher/login`);
    console.log(`        Staff# KSS003  |  ID: 34567890\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
