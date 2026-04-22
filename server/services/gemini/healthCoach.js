import { getModel } from './client.js';
import {
  buildCreateGoalPrompt,
  buildHealthCoachPrompt,
  buildNutritionEstimatePrompt,
  buildRepairGoalJsonPrompt,
  buildRepairNutritionJsonPrompt
} from './prompts.js';
import { getUserById } from '../../data/users.js';
import { getGoalsByUserId } from '../../data/goals.js';
import helperMethods from '../../helpers.js';
import { calculateMaintenanceCalories } from '../nutrition.js';

function stripJsonFenceFromText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/```json\s*[\s\S]*?```/gi, '').trim();
}

function extractJsonFromText(text) {
  if (typeof text !== 'string') return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (e) {
      return null;
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch (e) {
    return null;
  }
}

function validateGoalJson(goalJson) {
  if (!goalJson || typeof goalJson !== 'object' || Array.isArray(goalJson)) return null;

  const allowedTopKeys = ['description', 'target', 'type', 'weeklyPlan'];
  const keys = Object.keys(goalJson).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowedTopKeys)) return null;

  if (typeof goalJson.type !== 'string' || !goalJson.type.trim()) return null;
  if (typeof goalJson.target !== 'string' || !goalJson.target.trim()) return null;
  if (typeof goalJson.description !== 'string' || !goalJson.description.trim()) return null;

  const weeklyPlan = goalJson.weeklyPlan;
  if (!weeklyPlan || typeof weeklyPlan !== 'object' || Array.isArray(weeklyPlan)) return null;

  const requiredDays = ['friday', 'monday', 'saturday', 'sunday', 'thursday', 'tuesday', 'wednesday'];
  const weeklyKeys = Object.keys(weeklyPlan).sort();
  if (JSON.stringify(weeklyKeys) !== JSON.stringify(requiredDays)) return null;

  for (const day of requiredDays) {
    if (typeof weeklyPlan[day] !== 'string' || !weeklyPlan[day].trim()) return null;
  }

  return goalJson;
}

function validateNutritionEstimateJson(nutritionJson) {
  if (!nutritionJson || typeof nutritionJson !== 'object' || Array.isArray(nutritionJson)) return null;

  const allowedTopKeys = ['meals', 'notes'];
  const keys = Object.keys(nutritionJson).sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowedTopKeys)) return null;

  if (typeof nutritionJson.notes !== 'string' || !nutritionJson.notes.trim()) return null;
  if (!Array.isArray(nutritionJson.meals) || !nutritionJson.meals.length) return null;

  const normalizedMeals = nutritionJson.meals.map((meal) => {
    if (!meal || typeof meal !== 'object' || Array.isArray(meal)) return null;
    const mealKeys = Object.keys(meal).sort();
    const allowedMealKeys = ['estimatedCalories', 'items', 'mealType'];
    if (JSON.stringify(mealKeys) !== JSON.stringify(allowedMealKeys)) return null;
    if (typeof meal.mealType !== 'string' || !meal.mealType.trim()) return null;
    if (!Array.isArray(meal.items) || !meal.items.length) return null;

    const items = meal.items
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    if (!items.length) return null;

    const estimatedCalories = Math.round(Number(meal.estimatedCalories));
    if (!Number.isFinite(estimatedCalories) || estimatedCalories <= 0) return null;

    return {
      mealType: meal.mealType.trim().toLowerCase(),
      items,
      estimatedCalories
    };
  });

  if (normalizedMeals.some((meal) => !meal)) return null;

  return {
    meals: normalizedMeals,
    notes: nutritionJson.notes.trim()
  };
}

async function repairGoalJsonFromTranscript({ userMessage, userId, assistantTranscript }) {
  try {
    const model = getModel();
    const userProfile = await getUserById(userId);
    const prompt = buildRepairGoalJsonPrompt({ userMessage, userProfile, assistantTranscript });
    const result = await model.generateContent(prompt);
    return validateGoalJson(extractJsonFromText(result.response.text()));
  } catch (e) {
    console.error('repairGoalJsonFromTranscript:', e);
    return null;
  }
}

async function repairNutritionEstimateJson({ date, userMessage, userId, assistantTranscript }) {
  try {
    const model = getModel();
    const userProfile = await getUserById(userId);
    const prompt = buildRepairNutritionJsonPrompt({
      date,
      userMessage,
      userProfile,
      assistantTranscript
    });
    const result = await model.generateContent(prompt);
    return validateNutritionEstimateJson(extractJsonFromText(result.response.text()));
  } catch (e) {
    console.error('repairNutritionEstimateJson:', e);
    return null;
  }
}

function buildNutritionLogPayload({ date, userMessage, nutritionEstimateJson, maintenanceCalories }) {
  const meals = nutritionEstimateJson.meals.map((meal) => ({
    mealType: meal.mealType,
    items: meal.items,
    estimatedCalories: meal.estimatedCalories
  }));
  const totalCalories = meals.reduce((sum, meal) => sum + meal.estimatedCalories, 0);

  return {
    date,
    mealType: 'daily_summary',
    description: helperMethods.checkString(userMessage, 'message'),
    calories: totalCalories,
    maintenanceCalories,
    calorieDelta: totalCalories - maintenanceCalories,
    meals,
    notes: nutritionEstimateJson.notes,
    source: 'ai_estimate'
  };
}

function buildNutritionMessage(nutritionLog) {
  const mealCount = nutritionLog.meals.length;
  const delta = nutritionLog.calorieDelta;
  const direction = delta === 0 ? 'right at' : delta > 0 ? 'over' : 'under';
  const difference = Math.abs(delta);

  if (delta === 0) {
    return `Estimated ${nutritionLog.calories} calories across ${mealCount} meal${mealCount === 1 ? '' : 's'}. That is right at your estimated maintenance of ${nutritionLog.maintenanceCalories} calories.`;
  }

  return `Estimated ${nutritionLog.calories} calories across ${mealCount} meal${mealCount === 1 ? '' : 's'}. That is about ${difference} calories ${direction} your estimated maintenance of ${nutritionLog.maintenanceCalories} calories.`;
}

const runCreateGoalStream = async ({ userMessage, userId, onDelta, onRepairStart }) => {
  const model = getModel();
  const userProfile = await getUserById(userId);
  const prompt = buildCreateGoalPrompt({ userMessage, userProfile });
  const result = await model.generateContentStream(prompt);

  let fullText = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (!text) continue;
    fullText += text;
    if (typeof onDelta === 'function') onDelta(text);
  }

  let goalJson = validateGoalJson(extractJsonFromText(fullText));
  if (!goalJson) {
    if (typeof onRepairStart === 'function') onRepairStart();
    goalJson = await repairGoalJsonFromTranscript({
      userMessage,
      userId,
      assistantTranscript: fullText
    });
  }

  return {
    fullText,
    displayText: stripJsonFenceFromText(fullText),
    goalJson
  };
};

const getHealthCoachResponse = async ({ userMessage, userId }) => {
  try {
    const model = getModel();
    const userProfile = await getUserById(userId);
    const goals = await getGoalsByUserId(userId, { status: 'active' });
    const prompt = buildHealthCoachPrompt({ userMessage, userProfile, goals });
    const result = await model.generateContent(prompt);

    return { success: true, message: result.response.text() };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
};

const getCreateGoalResponse = async ({ userMessage, userId }) => {
  try {
    const model = getModel();
    const userProfile = await getUserById(userId);
    const prompt = buildCreateGoalPrompt({ userMessage, userProfile });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let goalJson = validateGoalJson(extractJsonFromText(text));
    if (!goalJson) {
      goalJson = await repairGoalJsonFromTranscript({
        userMessage,
        userId,
        assistantTranscript: text
      });
    }

    return {
      success: true,
      message: stripJsonFenceFromText(text) || text,
      goalJson,
      raw: text
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, message: 'Something went wrong. Please try again.', goalJson: null };
  }
};

const getNutritionEstimateResponse = async ({ userMessage, userId, date }) => {
  const normalizedDate = helperMethods.checkDate(date, 'date');
  const userProfile = await getUserById(userId);
  const maintenance = calculateMaintenanceCalories(userProfile?.biometrics || {});

  if (!maintenance.available) {
    throw new Error(
      `Nutrition estimates need biometrics for: ${maintenance.missingFields.join(', ')}`
    );
  }

  try {
    const model = getModel();
    const prompt = buildNutritionEstimatePrompt({
      date: normalizedDate,
      userMessage,
      userProfile
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let nutritionEstimateJson = validateNutritionEstimateJson(extractJsonFromText(text));
    if (!nutritionEstimateJson) {
      nutritionEstimateJson = await repairNutritionEstimateJson({
        date: normalizedDate,
        userMessage,
        userId,
        assistantTranscript: text
      });
    }

    if (!nutritionEstimateJson) {
      return {
        success: false,
        message: 'Could not build a valid nutrition estimate. Please try again.',
        nutritionJson: null
      };
    }

    const nutritionJson = buildNutritionLogPayload({
      date: normalizedDate,
      userMessage,
      nutritionEstimateJson,
      maintenanceCalories: maintenance.calories
    });

    return {
      success: true,
      message: buildNutritionMessage(nutritionJson),
      nutritionJson
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      success: false,
      message: 'Something went wrong while estimating nutrition. Please try again.',
      nutritionJson: null
    };
  }
};

export {
  getCreateGoalResponse,
  getHealthCoachResponse,
  getNutritionEstimateResponse,
  runCreateGoalStream,
  stripJsonFenceFromText
};
