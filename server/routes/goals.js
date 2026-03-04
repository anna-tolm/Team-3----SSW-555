import { Router } from 'express';
const router = Router();
import { goalData } from '../data/index.js';
import { helperMethods } from '../helpers.js';
import { generatePlanForGoal } from '../planService.js';

// POST /goals - create goal (body: userId, type, target?, description?, plan?)
router.route('/').post(async (req, res) => {
  try {
    const { userId, ...goalDataPayload } = req.body;
    const id = helperMethods.checkId(userId, 'userId');
    const goal = await goalData.createGoal(id, { ...goalDataPayload, userId: id });
    res.status(201).json(goal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// GET /goals/user/:userId - get all goals for user (query: status)
router.route('/user/:userId').get(async (req, res) => {
  try {
    const userId = helperMethods.checkId(req.params.userId, 'userId');
    const goals = await goalData.getGoalsByUserId(userId, { status: req.query.status });
    res.json(goals);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// GET /goals/:id - get one goal by id
router.route('/:id').get(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const goal = await goalData.getGoalById(id);
    res.json(goal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// PATCH /goals/:id - update goal (target, description, status)
router.route('/:id').patch(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const existing = await goalData.getGoalById(id);
    const goal = await goalData.updateGoal(existing.userId, id, req.body);
    res.json(goal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// POST /goals/:id/plan/ai - generate plan via Gemini and save to goal
router.route('/:id/plan/ai').post(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const goal = await generatePlanForGoal(id);
    res.json(goal);
  } catch (e) {
    const status = e?.message?.includes('not set') ? 503 : (e?.message?.includes('not found') ? 404 : 400);
    res.status(status).json({ error: e?.message ?? e });
  }
});

// PUT /goals/:id/plan - set plan manually (body: plan object or { plan: ... })
router.route('/:id/plan').put(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const plan = req.body.plan !== undefined ? req.body.plan : req.body;
    const existing = await goalData.getGoalById(id);
    const goal = await goalData.updatePlan(existing.userId, id, plan);
    res.json(goal);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

// DELETE /goals/:id
router.route('/:id').delete(async (req, res) => {
  try {
    const id = helperMethods.checkId(req.params.id, 'id');
    const existing = await goalData.getGoalById(id);
    const result = await goalData.deleteGoal(existing.userId, id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? e });
  }
});

export default router;
