import { Router } from 'express';
const router = Router();
import { userData } from '../data/index.js';
import helperMethods from '../helpers.js';
import { requireAuth, requireMatchingUser } from '../middleware.js'; 

// GET /users - list all users (e.g. admin)
router.route('/').get(async (req, res) => {
  try {
    const userList = await userData.getAllUsers();
    res.json(userList);
  } catch (e) {
    res.status(500).json({ error: e?.message ?? e });
  }
});

// POST /users/register - create account
router.route('/register').post(async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    const user = await userData.createUser(name, email, password);
    res.status(201).redirect('/login.html');
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// POST /users/login - verify credentials, then redirect to profile page
router.route('/login').post(async (req, res) => {
  try {
    const { email, password } = req.body;
    const profile = await userData.loginUser(email, password);

    res.cookie('userId', profile._id.toString(), {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.redirect(`/profile.html?id=${encodeURIComponent(profile._id)}`);
  } catch (e) {
    res.status(401).json({ error: e?.message ?? e });
  }
});

// GET /users/:id - get user profile by id
router.route('/:id').get(requireAuth, requireMatchingUser, async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const user = await userData.getUserById(id);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// PATCH /users/:id - update profile
router.route('/:id').patch(requireAuth, requireMatchingUser, async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const user = await userData.updateUser(id, req.body);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// Old login without cookies/sessions
// router.route('/login').post(async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const profile = await userData.loginUser(email, password);
//     // Redirect to static profile page with the user id in the query string
//     return res.redirect(`/profile.html?id=${encodeURIComponent(profile._id)}`);
//   } catch (e) {
//     // For now, on error just send JSON; you can swap to an HTML error page later.
//     res.status(401).json({ error: e?.message ?? e });
//   }
// });

// // GET /users/:id - get user profile by id (no password)
// router.route('/:id').get(async (req, res) => {
//   try {
//     const id = helperMethods.checkId(req.params.id, 'id');
//     const user = await userData.getUserById(id);
//     res.json(user);
//   } catch (e) {
//     res.status(400).json({ error: e?.message ?? e });
//   }
// });

// // PATCH /users/:id - update profile (e.g. name)
// router.route('/:id').patch(async (req, res) => {
//   try {
//     const id = helperMethods.checkId(req.params.id, 'id');
//     const user = await userData.updateUser(id, req.body);
//     res.json(user);
//   } catch (e) {
//     res.status(400).json({ error: e?.message ?? e });
//   }
// });

// PUT /users/:id/biometrics - set/replace biometrics
router.route('/:id/biometrics').put(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const biometrics = await userData.updateBiometrics(id, req.body);
    res.json({ biometrics });
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// POST /users/:id/progress - add progress entry
router.route('/:id/progress').post(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const entry = await userData.addProgressEntry(id, req.body);
    res.status(201).json(entry);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// GET /users/:id/progress - get progress entries (query: from, to)
router.route('/:id/progress').get(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const entries = await userData.getProgressEntries(id, {
      from: req.query.from,
      to: req.query.to
    });
    res.json(entries);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// POST /users/:id/meals - log a meal
router.route('/:id/meals').post(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const meal = await userData.addMealLog(id, req.body);
    res.status(201).json(meal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// GET /users/:id/meals - get meal logs (query: from, to)
router.route('/:id/meals').get(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const logs = await userData.getMealLogs(id, {
      from: req.query.from,
      to: req.query.to
    });
    res.json(logs);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// PATCH /users/:id/meals/:mealId - update a saved meal log
router.route('/:id/meals/:mealId').patch(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const mealId = helperMethods.checkId(req.params.mealId, 'mealId');
    const meal = await userData.updateMealLog(id, mealId, req.body);
    res.json(meal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// DELETE /users/:id/meals/:mealId - delete a saved meal log
router.route('/:id/meals/:mealId').delete(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const mealId = helperMethods.checkId(req.params.mealId, 'mealId');
    const result = await userData.deleteMealLog(id, mealId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

export default router;
