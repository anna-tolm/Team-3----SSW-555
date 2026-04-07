import { users } from '../config/mongoCollections.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import helperMethods from '../helpers.js';

// USER SCHEMA
// type User = {
//     _id: ObjectId;
//     name: string;                            // required
//     email: string;                           // required (stored lowercase; should be UNIQUE)
//     password: string;                        // required (bcrypt hash)
//     biometrics: null | Record<string, any>;  // set via PUT /users/:id/biometrics
//     progressEntries: ProgressEntry[];        // default []
//     mealLogs: MealLog[];                     // default []
//     dateJoined: Date;                        // required
//   };

// type Biometrics = {
//     age: number;
//     sex: "male" | "female" | "non-binary" | "other";
//     heightIn: number;               
//     weightLbs: number;
//
//     <OPTIONAL FIELDS BELOW>
//     goalWeightLbs: number;             
//     activityLevel: "low" | "light" | "moderate" | "active" | "very_active";
//     bodyFatPercent: number;                  
//     restingHeartRate: number;         
//     medicalConditions: string[];           
//     dietaryPreferences: {         
//       "vegetarian": boolean,
//       "vegan": boolean,
//       "glutenFree": boolean,
//       "lactoseIntolerant": boolean;
//       "allergies": string[] // will be filled in by the user; AI would interpret these (such as "peanuts" and "shellfish")
//     },
//     injuriesOrLimitations: string[]; // will be filled in by the user; AI would interpret these (such as "knee pain when running")
//     sleepHoursPerNight: number
//   }

// type ProgressEntry = {
//     _id: ObjectId;                           // generated when added
//     date: string;                            // "YYYY-MM-DD"
//     [key: string]: any;
//   };
  
// type MealLog = {
//     _id: ObjectId;                 // generated when added
//     date: string;                  // "YYYY-MM-DD"
//     mealType: string;              // required
//     description: string;           // required
//     calories?: number;             // optional
//     [key: string]: any;
//   };

// Create a new user (registration). Hashes password and stores profile.
export const createUser = async (name, email, password) => {
  name = helperMethods.checkString(name, 'name');
  email = helperMethods.checkEmail(email);
  helperMethods.checkPassword(password);

  const usersCollection = await users();
  const existing = await usersCollection.findOne({ email: email.toLowerCase() });
  if (existing) throw 'A user with that email already exists';

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    biometrics: null,
    progressEntries: [],
    mealLogs: [],
    dateJoined: new Date()
  };

  const insertResult = await usersCollection.insertOne(newUser);
  if (!insertResult.acknowledged || !insertResult.insertedId) throw 'Could not create user';

  return {
    _id: insertResult.insertedId.toString(),
    name: newUser.name,
    email: newUser.email
  };
};

// Get user by ID (profile without password).
export const getUserById = async (id) => {
  id = helperMethods.checkId(id, 'id');
  const usersCollection = await users();
  const user = await usersCollection.findOne({ _id: new ObjectId(id) });
  if (!user) throw 'User not found';
  const { password, ...profile } = user;
  profile._id = profile._id.toString();
  if (profile.dateJoined) profile.dateJoined = profile.dateJoined.toISOString();
  return profile;
};

// Get user by email (for login). Returns id, email, name; password check done separately in loginUser.
export const getUserByEmail = async (email) => {
  email = helperMethods.checkEmail(email);
  const usersCollection = await users();
  const user = await usersCollection.findOne({ email: email.toLowerCase() });
  if (!user) throw 'Either the email or password is incorrect';
  return {
    _id: user._id.toString(),
    email: user.email,
    name: user.name,
    passwordHash: user.password
  };
};

// Verify credentials and return user profile (no password).
export const loginUser = async (email, password) => {
  const user = await getUserByEmail(email);
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw 'Either the email or password is incorrect';
  const { passwordHash, ...profile } = user;
  return profile;
};

// Update basic profile fields (name, etc.). Does not update password or email here.
export const updateUser = async (id, updates) => {
  id = helperMethods.checkId(id, 'id');
  const allowed = ['name'];
  const toSet = {};
  if (updates.name !== undefined) toSet.name = helperMethods.checkString(updates.name, 'name');
  if (Object.keys(toSet).length === 0) throw 'No valid fields to update';
  
  const usersCollection = await users();
  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: toSet },
    { returnDocument: 'after' }
  );
  if (!result) throw 'User not found';
  const { password, ...profile } = result;
  profile._id = profile._id.toString();
  if (profile.dateJoined) profile.dateJoined = profile.dateJoined.toISOString();
  return profile;
};

// Set or replace biometrics for a user (weight, height, age, sex, activityLevel, etc.).
export const updateBiometrics = async (userId, biometrics) => {
  userId = helperMethods.checkId(userId, 'userId');
  if (!biometrics || typeof biometrics !== 'object') throw 'Biometrics must be an object';

  const usersCollection = await users();
  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { biometrics } },
    { returnDocument: 'after' }
  );
  if (!result) throw 'User not found';
  return result.biometrics;
};

// Add a progress entry (e.g. weekly weigh-in, steps, notes).
export const addProgressEntry = async (userId, entry) => {
  userId = helperMethods.checkId(userId, 'userId');

  if (!entry || typeof entry !== 'object') throw 'Progress entry must be an object';
  const date = entry.date ? helperMethods.checkDate(entry.date, 'date') : new Date().toISOString().split('T')[0];
  const progressEntry = { ...entry, date, _id: new ObjectId() };

  const usersCollection = await users();
  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $push: { progressEntries: progressEntry } },
    { returnDocument: 'after' }
  );
  if (!result) throw 'User not found';
  const added = result.progressEntries[result.progressEntries.length - 1];
  added._id = added._id.toString();
  return added;
};

// Get progress entries for a user, optionally filtered by date range.
export const getProgressEntries = async (userId, options = {}) => {
  userId = helperMethods.checkId(userId, 'userId');
  const usersCollection = await users();
  const user = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { progressEntries: 1 } }
  );
  if (!user) throw 'User not found';
  let entries = user.progressEntries || [];

  if (options.from || options.to) {
    const from = options.from ? new Date(options.from) : null;
    const to = options.to ? new Date(options.to) : null;
    entries = entries.filter((e) => {
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  return entries.map((e) => ({ ...e, _id: e._id?.toString?.() || e._id }));
};

// Log a meal for a user.
export const addMealLog = async (userId, meal) => {
  userId = helperMethods.checkId(userId, 'userId');
  if (!meal || typeof meal !== 'object') throw 'Meal log must be an object';
  meal.mealType = helperMethods.checkString(meal.mealType, 'mealType');
  meal.description = helperMethods.checkString(meal.description, 'description');
  const date = meal.date ? helperMethods.checkDate(meal.date, 'date') : new Date().toISOString().split('T')[0];
  const mealEntry = { ...meal, date, _id: new ObjectId() };

  const usersCollection = await users();
  const result = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $push: { mealLogs: mealEntry } },
    { returnDocument: 'after' }
  );
  if (!result) throw 'User not found';
  const added = result.mealLogs[result.mealLogs.length - 1];
  added._id = added._id.toString();
  return added;
};

// Get meal logs for a user, optionally by date range.
export const getMealLogs = async (userId, options = {}) => {
  userId = helperMethods.checkId(userId, 'userId');
  const usersCollection = await users();
  const user = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { mealLogs: 1 } }
  );
  if (!user) throw 'User not found';
  let logs = user.mealLogs || [];

  if (options.from || options.to) {
    const from = options.from ? new Date(options.from) : null;
    const to = options.to ? new Date(options.to) : null;
    logs = logs.filter((e) => {
      const d = new Date(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  return logs.map((e) => ({ ...e, _id: e._id?.toString?.() || e._id }));
};

// Get all users (for admin/debug). Excludes passwords.
export const getAllUsers = async () => {
  const usersCollection = await users();
  const list = await usersCollection.find({}).project({ password: 0 }).toArray();
  return list.map((u) => ({
    ...u,
    _id: u._id.toString(),
    dateJoined: u.dateJoined?.toISOString?.()
  }));
};
