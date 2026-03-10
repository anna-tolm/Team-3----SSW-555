// Middleware will be necessary when protecting login and registration routes in the session in the future
// e.g., stops users from accessing another user's profile simply by typing in the URL /users/:id of the desired user
// will be necessary when we build frontend register/login pages just like public/form_validate.js   - Collin

// Use redirectIfLoggedIn on GET /login and GET /register.
// Use requireAuth on routes that need a logged-in user (e.g. /dashboard, /signout).

const middleware = {
  /** If user is logged in, redirect to home. Use for /login and /register GET. */
  redirectIfLoggedIn(req, res, next) {
    if (req.session && req.session.user) {
      return res.redirect('/');
    }
    next();
  },

  /** If no user in session, redirect to /login. Use for protected routes. */
  requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    next();
  }
};

export default middleware;
