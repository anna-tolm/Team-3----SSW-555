//calls gemini using model + promp, returns response

import { getModel } from "./client.js";
import { buildHealthCoachPrompt, buildCreateGoalPrompt, buildRepairGoalJsonPrompt } from "./prompts.js";
import { getUserById } from '../../data/users.js';
import { getGoalsByUserId } from '../../data/goals.js';

/** Remove fenced JSON from assistant text so the chat UI shows only the readable plan. */
function stripJsonFenceFromText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/```json\s*[\s\S]*?```/gi, '').trim();
}

function extractGoalJsonFromText(text) {
  if (typeof text !== 'string') return null;

  // Preferred: fenced json block.
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (e) {
      // fall through
    }
  }

  // Fallback: try to parse the first top-level JSON object in the text.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      return null;
    }
  }

  return null;
}

function validateGoalJson(goalJson) {
  if (!goalJson || typeof goalJson !== 'object' || Array.isArray(goalJson)) return null;

  const allowedTopKeys = ['type', 'target', 'description', 'weeklyPlan'];
  const keys = Object.keys(goalJson).sort();
  const allowedSorted = [...allowedTopKeys].sort();
  if (JSON.stringify(keys) !== JSON.stringify(allowedSorted)) return null;

  if (typeof goalJson.type !== 'string' || !goalJson.type.trim()) return null;
  if (typeof goalJson.target !== 'string' || !goalJson.target.trim()) return null;
  if (typeof goalJson.description !== 'string' || !goalJson.description.trim()) return null;

  const wp = goalJson.weeklyPlan;
  if (!wp || typeof wp !== 'object' || Array.isArray(wp)) return null;
  const requiredDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wpKeys = Object.keys(wp).sort();
  if (JSON.stringify(wpKeys) !== JSON.stringify([...requiredDays].sort())) return null;
  for (const day of requiredDays) {
    if (typeof wp[day] !== 'string' || !wp[day].trim()) return null;
  }

  return goalJson;
}

async function repairGoalJsonFromTranscript({ userMessage, userId, assistantTranscript }) {
  try {
    const model = getModel();
    const userProfile = await getUserById(userId);
    const prompt = buildRepairGoalJsonPrompt({ userMessage, userProfile, assistantTranscript });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return validateGoalJson(extractGoalJsonFromText(text));
  } catch (e) {
    console.error('repairGoalJsonFromTranscript:', e);
    return null;
  }
}

/**
 * Single consumer for the Gemini stream: accumulates full text, calls onDelta per chunk,
 * then validates JSON and runs a repair pass if needed.
 */
const runCreateGoalStream = async ({ userMessage, userId, onDelta, onRepairStart }) => {
  const model = getModel();
  const userProfile = await getUserById(userId);
  const prompt = buildCreateGoalPrompt({ userMessage, userProfile });
  const result = await model.generateContentStream(prompt);

  let fullText = '';
  for await (const chunk of result.stream) {
    const t = chunk.text();
    if (t) {
      fullText += t;
      if (typeof onDelta === 'function') onDelta(t);
    }
  }

  let goalJson = validateGoalJson(extractGoalJsonFromText(fullText));
  if (!goalJson) {
    if (typeof onRepairStart === 'function') onRepairStart();
    goalJson = await repairGoalJsonFromTranscript({
      userMessage,
      userId,
      assistantTranscript: fullText
    });
  }

  const displayText = stripJsonFenceFromText(fullText);
  return { fullText, displayText, goalJson };
};

const getHealthCoachResponse = async ({ userMessage, userId }) => {
  try {
    const model = getModel();

    const userProfile = await getUserById(userId);
    const goals = await getGoalsByUserId(userId, { status: 'active' });

    const prompt = buildHealthCoachPrompt({ userMessage, userProfile, goals });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return { success: true, message: response };
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

    let goalJson = validateGoalJson(extractGoalJsonFromText(text));
    if (!goalJson) {
      goalJson = await repairGoalJsonFromTranscript({
        userMessage,
        userId,
        assistantTranscript: text
      });
    }
    const displayText = stripJsonFenceFromText(text);

    return { success: true, message: displayText || text, goalJson, raw: text };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, message: 'Something went wrong. Please try again.', goalJson: null };
  }
};

// Streaming is handled by runCreateGoalStream (single stream consumer — see healthCoach route).



//  const getHealthCoachResponse = async ({ userMessage, userProfile }) => {
//  try{
//     const model = getModel();
//     const userProfile = await getUserById(userId);
//     const goals = await getGoalsByUserId(userId, {status: 'active'});
//     const prompt = buildHealthCoachPrompt ({ userMessage, userProfile, goals });
//     const result = await model.generateContent(prompt);
//     const response = result.response.text();

//     return { success: true, message: response };

//  } catch (error) {
//     console.error("Gemini API Error:", error);
//     return {success: false, message: "Something went wrong, please try again.;"}
//  }
// };
export { getHealthCoachResponse, getCreateGoalResponse, runCreateGoalStream, stripJsonFenceFromText };