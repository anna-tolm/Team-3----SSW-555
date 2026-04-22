import { calculateMaintenanceCalories } from '../nutrition.js';

function formatBiometricsContext(userProfile = {}) {
  const b = userProfile.biometrics || {};

  return `
Age: ${b.age ?? 'unknown'}
Sex: ${b.sex ?? 'unknown'}
HeightIn: ${b.heightIn ?? 'unknown'}
WeightLbs: ${b.weightLbs ?? 'unknown'}
GoalWeightLbs: ${b.goalWeightLbs ?? 'unknown'}
ActivityLevel: ${b.activityLevel ?? 'unknown'}
MedicalConditions: ${Array.isArray(b.medicalConditions) ? b.medicalConditions.join(', ') : (b.medicalConditions ?? 'none')}
DietaryPreferences: ${Array.isArray(b.dietaryPreferences) ? b.dietaryPreferences.join(', ') : (b.dietaryPreferences ?? 'none')}
InjuriesOrLimitations: ${Array.isArray(b.injuriesOrLimitations) ? b.injuriesOrLimitations.join(', ') : (b.injuriesOrLimitations ?? 'none')}
SleepHoursPerNight: ${b.sleepHoursPerNight ?? 'unknown'}
`.trim();
}

function formatMaintenanceContext(userProfile = {}) {
  const biometrics = userProfile.biometrics || {};
  const maintenance = calculateMaintenanceCalories(biometrics);

  if (!maintenance.available) {
    return `EstimatedMaintenanceCalories: unavailable (missing ${maintenance.missingFields.join(', ')})`;
  }

  return `EstimatedMaintenanceCalories: ${maintenance.calories} calories/day`;
}

const buildHealthCoachPrompt = ({ userMessage, userProfile = {}, goals = [] }) => {
  const biometricsContext = formatBiometricsContext(userProfile);
  const maintenanceContext = formatMaintenanceContext(userProfile);
  const goalsContext = goals?.length
    ? goals.map((g) => `- Goal Type: ${g.type}, Target: ${g.target}, Description: ${g.description}`).join('\n')
    : 'No active goals';

  const mealContext = userProfile.mealLogs?.slice(-6).map((m) =>
    `- ${m.date} | ${m.mealType}: ${m.description} ${m.calories ? `(${m.calories} cal)` : ''}`
  ).join('\n') || 'No recent meals logged.';

  const progressContext = userProfile.progressEntries?.slice(-5).map((p) =>
    `- ${p.date}: ${JSON.stringify(p)}`
  ).join('\n') || 'No recent progress entries.';

  const systemContext = `
You are a supportive and knowledgeable health coach.
Your role is to provide personalized guidance on nutrition and fitness.
Always recommend consulting a doctor for medical advice and concerns.
Keep responses concise, actionable, and encouraging.

Nutrition guidance rules:
- If you suggest a meal plan, day of eating, or nutrition recommendations, use the estimated maintenance calories below as the default daily target unless the user explicitly asks for a deficit or surplus.
- If the user explicitly asks to lose weight, use a moderate calorie deficit rather than an aggressive one.
- If the user explicitly asks to gain weight, use a moderate calorie surplus rather than an excessive one.
- When you give a meal plan or meal recommendations, mention the approximate daily calorie target and keep the food volume reasonably aligned with it.

USER BIOMETRICS:
${biometricsContext}

ESTIMATED ENERGY TARGET:
${maintenanceContext}

USER GOALS:
${goalsContext}

RECENT MEAL LOGS:
${mealContext}

RECENT PROGRESS:
${progressContext}
  `.trim();

  return `${systemContext}\n\nUser: ${userMessage}`;
};

const buildCreateGoalPrompt = ({ userMessage, userProfile = {} }) => {
  const biometricsContext = formatBiometricsContext(userProfile);
  const maintenanceContext = formatMaintenanceContext(userProfile);

  const systemContext = `
You are an expert health coach that creates safe, personalized weekly plans.

Hard constraints:
- Respect dietary preferences strictly (for example, if vegetarian, do not include meat or fish).
- Respect injuries and limitations strictly (avoid exercises that aggravate them).
- If medical conditions exist, provide conservative advice and include a brief "consult clinician" note.
- If you create a nutrition or meal-focused plan and the user does not explicitly ask for a calorie deficit or surplus, target roughly the estimated maintenance calories listed below.
- If the user explicitly asks to lose weight, use a moderate deficit instead of maintenance.
- If the user explicitly asks to gain weight, use a moderate surplus instead of maintenance.
- When the weekly plan includes meals, make the portions and food quantity realistically match the intended calorie target.

You must produce TWO outputs in this exact order:

1) READABLE PLAN (GitHub-flavored Markdown)
   - Start with 1-2 short friendly sentences.
   - Then cover every calendar day Sunday through Saturday.
   - For each day, use a clear Markdown structure such as **Sunday:** or ### Sunday.
   - Under each day, use bullets for meals, exercises, sets, reps, or rest notes.
   - Put a blank line between days so it is easy to scan.
   - Do not put JSON, code fences, or raw key/value pairs in this section.

2) MACHINE-READABLE GOAL
   After the readable plan, output exactly one fenced JSON block:

\`\`\`json
{
  "type": "nutrition" | "fitness" | "weight gain/loss",
  "target": "<concrete target string>",
  "description": "<one short sentence summarizing the goal>",
  "weeklyPlan": {
    "sunday": "<single string summarizing the day>",
    "monday": "<single string>",
    "tuesday": "<single string>",
    "wednesday": "<single string>",
    "thursday": "<single string>",
    "friday": "<single string>",
    "saturday": "<single string>"
  }
}
\`\`\`

Rules for the JSON block:
- Include all 7 keys under weeklyPlan.
- Each weeklyPlan value is one plain-text string.
- Top-level keys must be only: type, target, description, weeklyPlan.
- Use valid JSON only.

User biometrics/context:
${biometricsContext}

Estimated calorie target context:
${maintenanceContext}
`.trim();

  return `${systemContext}\n\nUser goal request: ${userMessage}`;
};

const buildRepairGoalJsonPrompt = ({ userMessage, userProfile = {}, assistantTranscript }) => {
  const biometricsContext = formatBiometricsContext(userProfile);

  return `
You fix and complete health-coach output into one valid JSON object for database storage.

User request: ${userMessage}

Biometrics:
${biometricsContext}

Assistant output (may be truncated or malformed):
---
${assistantTranscript}
---

Output only one fenced JSON block:
\`\`\`json
{
  "type": "nutrition" | "fitness" | "weight gain/loss",
  "target": "<string>",
  "description": "<string>",
  "weeklyPlan": {
    "sunday": "<string>",
    "monday": "<string>",
    "tuesday": "<string>",
    "wednesday": "<string>",
    "thursday": "<string>",
    "friday": "<string>",
    "saturday": "<string>"
  }
}
\`\`\`

Rules:
- weeklyPlan must have all 7 days.
- If a day is missing from the transcript, infer a reasonable day plan consistent with the rest and the biometrics.
- Use valid JSON only.
`.trim();
};

const buildNutritionEstimatePrompt = ({ date, userMessage, userProfile = {} }) => {
  const biometricsContext = formatBiometricsContext(userProfile);

  return `
You estimate calories for a daily food log.

The user will provide a loose meal log such as:
"breakfast: yogurt, cereal with milk. lunch: turkey sandwich. dinner: salmon and rice."

Your job:
- Identify each meal that appears in the log.
- Break each meal into the individual food items that were mentioned.
- Estimate total calories for each meal using common serving-size assumptions.
- Be conservative and realistic. If a portion size is ambiguous, choose a typical single-serving estimate.

Output only one fenced JSON block:
\`\`\`json
{
  "meals": [
    {
      "mealType": "breakfast",
      "items": ["yogurt", "cereal with milk"],
      "estimatedCalories": 420
    }
  ],
  "notes": "Short note about uncertainty or portion assumptions."
}
\`\`\`

Rules:
- meals must be an array with one object per meal explicitly mentioned by the user.
- mealType should be short lowercase text such as breakfast, lunch, dinner, snack, dessert, or drinks.
- items must contain plain strings only.
- estimatedCalories must be a positive integer.
- Do not add foods the user did not mention.
- Use valid JSON only.

Context date: ${date}
User biometrics/context:
${biometricsContext}

Meal log:
${userMessage}
`.trim();
};

const buildRepairNutritionJsonPrompt = ({ date, userMessage, userProfile = {}, assistantTranscript }) => {
  const biometricsContext = formatBiometricsContext(userProfile);

  return `
You fix malformed nutrition-estimate output into one valid JSON object.

Date: ${date}
Meal log: ${userMessage}

User biometrics/context:
${biometricsContext}

Assistant output (may be malformed or incomplete):
---
${assistantTranscript}
---

Output only one fenced JSON block:
\`\`\`json
{
  "meals": [
    {
      "mealType": "breakfast",
      "items": ["yogurt", "cereal with milk"],
      "estimatedCalories": 420
    }
  ],
  "notes": "Short note about uncertainty or portion assumptions."
}
\`\`\`

Rules:
- Keep only meals that the user explicitly mentioned.
- Use one object per mentioned meal.
- items must be a string array.
- estimatedCalories must be a positive integer.
- notes must be a short string.
- Use valid JSON only.
`.trim();
};

export {
  buildCreateGoalPrompt,
  buildHealthCoachPrompt,
  buildNutritionEstimatePrompt,
  buildRepairGoalJsonPrompt,
  buildRepairNutritionJsonPrompt
};
