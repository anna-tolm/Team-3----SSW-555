import { goals as goalsCollection } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import helperMethods from '../helpers.js';
import { getUserById } from './users.js';

const GOAL_STATUSES = ['active', 'completed', 'archived'];

function normalizeGoalStatus(status, varName = 'status') {
  const normalized = helperMethods.checkString(status, varName).toLowerCase();
  if (normalized === 'complete') return 'completed';
  if (normalized === 'archive') return 'archived';
  if (!GOAL_STATUSES.includes(normalized)) {
    throw `${varName} must be one of: ${GOAL_STATUSES.join(', ')}`;
  }
  return normalized;
}

// GOAL SCHEMA
// type Goal = {
//   _id: ObjectId;
//   userId: ObjectId;              // required (references users._id)
//   type: string;                  // required (e.g. "weight gain/loss" | "fitness" | "nutrition")
//   target: string;                // required -- could be a target weight, weightlifting personal record, etc
//   description: string;           // required -- description of the goal
//   weeklyPlan: {                  // required -- AI-suggested weekly plan for the goal, with recommended exercises, meals, etc. by day of the week
//     sunday: string;               // required -- description of the plan for Sunday
//     monday: string;               // required -- description of the plan for Monday
//     tuesday: string;              // required -- description of the plan for Tuesday
//     wednesday: string;            // required -- description of the plan for Wednesday
//     thursday: string;             // required -- description of the plan for Thursday
//     friday: string;               // required -- description of the plan for Friday
//     saturday: string;             // required -- description of the plan for Saturday
//   }
//   completedDays: string[];       // days the user has checked off (e.g. ["sunday", "monday"])
//   status: string;                // default "active" (e.g. "active", "completed", "archived")
//   createdAt: Date;               // generated when goal is created
//   updatedAt: Date;               // generated when goal is updated
// };

// Create a goal for a user with an optional AI-suggested plan.
export const createGoal = async (userId, goalData) => {
  userId = helperMethods.checkId(userId, 'userId');
  const user = await getUserById(userId);
  if (!user) throw 'User not found';
  if (!goalData || typeof goalData !== 'object') throw 'Goal data must be an object';
  const type = helperMethods.checkString(goalData.type || goalData.goalType, 'type');

  // Accept either weeklyPlan (preferred) or plan (legacy) and normalize.
  const weeklyPlan = goalData.weeklyPlan ?? goalData.plan;
  if (!weeklyPlan || typeof weeklyPlan !== 'object') throw 'weeklyPlan is required and must be an object';

  const requiredDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const normalizedWeeklyPlan = {};
  for (const day of requiredDays) {
    normalizedWeeklyPlan[day] = helperMethods.checkString(weeklyPlan[day], `weeklyPlan.${day}`);
  }

  const target = helperMethods.checkString(goalData.target, 'target');
  const description = helperMethods.checkString(goalData.description, 'description');

  const goal = {
    userId: new ObjectId(userId),
    type,
    target,
    description,
    weeklyPlan: normalizedWeeklyPlan,
    completedDays: [],
    status: goalData.status ? normalizeGoalStatus(goalData.status, 'status') : 'active',
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
  if (options.status) query.status = normalizeGoalStatus(options.status, 'status');

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
  if (!updates || typeof updates !== 'object') throw 'Updates must be an object';

  const toSet = { updatedAt: new Date() };
  const currentStatus = normalizeGoalStatus(goal.status || 'active', 'status');

  if (updates.target !== undefined) {
    if (currentStatus !== 'active') throw 'You can only edit goal details while the goal is active';
    toSet.target = helperMethods.checkString(updates.target, 'target');
  }
  if (updates.description !== undefined) {
    if (currentStatus !== 'active') throw 'You can only edit goal details while the goal is active';
    toSet.description = helperMethods.checkString(updates.description, 'description');
  }
  if (updates.status !== undefined) {
    toSet.status = normalizeGoalStatus(updates.status, 'status');
  }

  if (Object.keys(toSet).length === 1) {
    throw 'No valid fields to update';
  }

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
  if (!plan || typeof plan !== 'object') throw 'weeklyPlan must be an object';

  const requiredDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const normalizedWeeklyPlan = {};
  for (const day of requiredDays) {
    normalizedWeeklyPlan[day] = helperMethods.checkString(plan[day], `weeklyPlan.${day}`);
  }

  const col = await goalsCollection();
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(goalId) },
    { $set: { weeklyPlan: normalizedWeeklyPlan, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw 'Goal not found';
  return serializeGoal(result);
};

// Toggle a day as completed/incomplete for a goal.
export const toggleDayCompletion = async (goalId, day) => {
  goalId = helperMethods.checkId(goalId, 'goalId');
  const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (!validDays.includes(day)) throw 'Invalid day';

  const col = await goalsCollection();
  const goal = await col.findOne({ _id: new ObjectId(goalId) });
  if (!goal) throw 'Goal not found';
  const currentStatus = normalizeGoalStatus(goal.status || 'active', 'status');
  if (currentStatus === 'archived') throw 'Archived goals cannot be updated';

  const completedSet = new Set(Array.isArray(goal.completedDays) ? goal.completedDays : []);
  if (completedSet.has(day)) completedSet.delete(day);
  else completedSet.add(day);

  const nextCompletedDays = validDays.filter((validDay) => completedSet.has(validDay));
  const weeklyPlan = goal.weeklyPlan && typeof goal.weeklyPlan === 'object' ? goal.weeklyPlan : {};
  const planDays = validDays.filter((validDay) => typeof weeklyPlan[validDay] === 'string' && weeklyPlan[validDay].trim());
  const daysToCheck = planDays.length ? planDays : validDays;
  const allDaysCompleted = daysToCheck.every((validDay) => completedSet.has(validDay));
  const nextStatus = allDaysCompleted
    ? 'completed'
    : currentStatus === 'completed'
      ? 'active'
      : currentStatus;

  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(goalId) },
    {
      $set: {
        completedDays: nextCompletedDays,
        status: nextStatus,
        updatedAt: new Date()
      }
    },
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
    weeklyPlan: goal.weeklyPlan ?? null,
    completedDays: goal.completedDays ?? [],
    status: normalizeGoalStatus(goal.status || 'active', 'status'),
    createdAt: goal.createdAt?.toISOString?.(),
    updatedAt: goal.updatedAt?.toISOString?.()
  };
}
