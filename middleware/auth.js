// Protect admin routes — redirect to login if not authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  req.flash('error', 'Please log in to access the admin panel.');
  res.redirect('/admin/login');
}

// Redirect already-logged-in users away from login page
function redirectIfAuth(req, res, next) {
  if (req.session && req.session.adminId) return res.redirect('/admin/dashboard');
  next();
}

module.exports = { requireAuth, redirectIfAuth };
