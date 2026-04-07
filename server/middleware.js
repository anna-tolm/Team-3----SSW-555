// Middleware will be necessary when protecting login and registration routes in the session in the future
// e.g., stops users from accessing another user's profile simply by typing in the URL /users/:id of the desired user
// will be necessary when we build frontend register/login pages just like public/form_validate.js   - Collin

// Use redirectIfLoggedIn on GET /login and GET /register.
// Use requireAuth on routes that need a logged-in user (e.g. /dashboard, /signout).

export const requireAuth = (req, res, next) => {
  const userId = req.cookies?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.authUserId = userId;
  next();
};

export const requireMatchingUser = (req, res, next) => {
  const routeId = req.params.id;
  const authUserId = req.authUserId;

  if (routeId !== authUserId) {
    return res.status(403).json({ error: 'Not authorized to access this profile' });
  }

  next();
};