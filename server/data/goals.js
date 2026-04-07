import { goals as goalsCollection } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import helperMethods from '../helpers.js';
import { getUserById } from './users.js';

// GOAL SCHEMA
// type Goal = {
//   _id: ObjectId;
//   userId: ObjectId;              // required (references users._id)
//   type: string;                  // required (e.g. "weight" | "fitness" | "tracking")
//   target: any | null;            // optional
//   description: string | null;    // optional
//   plan: object | string | null;  // AI-suggested plan
//   status: string;                // default "active" (e.g. "active", "completed", "archived")
//   createdAt: Date;               // required
//   updatedAt: Date;               // required
// };

// Create a goal for a user with an optional AI-suggested plan.
export const createGoal = async (userId, goalData) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  if (!goalData || typeof goalData !== 'object') throw 'Goal data must be an object';
  const type = helperMethods.checkString(goalData.type || goalData.goalType, 'type');

  const goal = {
    userId: new ObjectId(userId),
    type,
    target: goalData.target ?? null,
    description: goalData.description ? helperMethods.checkString(goalData.description, 'description') : null,
    plan: goalData.plan ?? null,
    status: goalData.status || 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const col = await goalsCollection();
  const insertResult = await col.insertOne(goal);
  if (!insertResult.acknowledged || !insertResult.insertedId) throw 'Could not create goal';

  return getGoalById(insertResult.insertedId.toString());
};

// Get a single goal by ID.
export const getGoalById = async (goalId) => {
  goalId = helperMethods.checkId(goalId, 'goalId');
  const col = await goalsCollection();
  const goal = await col.findOne({ _id: new ObjectId(goalId) });
  if (!goal) throw 'Goal not found';
  return serializeGoal(goal);
};

// Get all goals for a user, keyed by userId.
export const getGoalsByUserId = async (userId, options = {}) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  const col = await goalsCollection();
  const query = { userId: new ObjectId(userId) };
  if (options.status) query.status = helperMethods.checkString(options.status, 'status');

  const list = await col.find(query).sort({ createdAt: -1 }).toArray();
  return list.map(serializeGoal);
};

// Update goal fields (e.g. target, description, status). Only a user can update their own goals.
export const updateGoal = async (userId, goalId, updates) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  goalId = helperMethods.checkId(goalId, 'goalId');
  const goal = await getGoalById(goalId);
  if (!goal) throw 'Goal not found';
  if (goal.userId.toString() !== userId) throw 'You can only update your own goals';
  if (goal.status !== 'active') throw 'You can only update active goals';
  if (!updates || typeof updates !== 'object') throw 'Updates must be an object';

  const toSet = { updatedAt: new Date() };
  if (updates.target !== undefined) toSet.target = updates.target;
  if (updates.description !== undefined) toSet.description = helperMethods.checkString(updates.description, 'description');
  if (updates.status !== undefined) toSet.status = helperMethods.checkString(updates.status, 'status');

  const col = await goalsCollection();
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(goalId) },
    { $set: toSet },
    { returnDocument: 'after' }
  );
  if (!result) throw 'Goal not found';
  return serializeGoal(result);
};

// Set or replace the AI-suggested plan for a goal. Only a user can update their own plan.
export const updatePlan = async (userId, goalId, plan) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  goalId = helperMethods.checkId(goalId, 'goalId');
  const goal = await getGoalById(goalId);
  if (!goal) throw 'Goal not found';
  if (goal.userId.toString() !== userId) throw 'You can only update your own goals';
  if (goal.status !== 'active') throw 'You can only update active goals';
  if (!plan || typeof plan !== 'object' && typeof plan !== 'string') throw 'Plan must be an object or string';

  const col = await goalsCollection();
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(goalId) },
    { $set: { plan, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw 'Goal not found';
  return serializeGoal(result);
};

// Delete a goal. Only a user can delete their own goals.
export const deleteGoal = async (userId, goalId) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  goalId = helperMethods.checkId(goalId, 'goalId');
  const goal = await getGoalById(goalId);
  if (!goal) throw 'Goal not found';
  if (goal.userId.toString() !== userId) throw 'You can only delete your own goals';

  const col = await goalsCollection();
  const result = await col.findOneAndDelete({ _id: new ObjectId(goalId) });
  if (!result) throw 'Goal not found';
  return { deleted: true, id: goalId };
};

// Serialize a goal object to a plain object.
function serializeGoal(goal) {
  return {
    _id: goal._id.toString(),
    userId: goal.userId.toString(),
    type: goal.type,
    target: goal.target,
    description: goal.description,
    plan: goal.plan,
    status: goal.status,
    createdAt: goal.createdAt?.toISOString?.(),
    updatedAt: goal.updatedAt?.toISOString?.()
  };
}
