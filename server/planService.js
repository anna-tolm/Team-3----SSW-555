import { goalData } from './data/index.js';
import { helperMethods } from './helpers.js';
import { aiConfig, getGeminiClient } from './config/aiSettings.js';

export const generatePlanForGoal = async (goalId) => {
  const id = helperMethods.checkId(goalId, 'goalId');
  const existingGoal = await goalData.getGoalById(id);

  const client = getGeminiClient();
  if (!client) {
    throw new Error('Gemini API client not set. Ensure GEMINI_API_KEY is configured.');
  }

  const prompt = `
You are an AI health coach. Create a structured, realistic plan for the following goal.

User goal:
Type: ${existingGoal.type}
Target: ${existingGoal.target ?? 'N/A'}
Description: ${existingGoal.description ?? 'N/A'}

Return JSON with fields:
- summary: short string
- weeklySchedule: array of 7 objects { day, activities }
- tips: array of strings
  `;

  const model = client.getGenerativeModel({ model: aiConfig.modelName });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    plan = { summary: text, weeklySchedule: [], tips: [] };
  }

  const updatedGoal = await goalData.updatePlan(existingGoal.userId, id, plan);
  return updatedGoal;
};

