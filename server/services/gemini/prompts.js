//message that gets sent to gemini

const buildHealthCoachPrompt = ({ userMessage, userProfile = {}, goals = []}) => {
    const b = userProfile.biometrics || {};
    const biometricsContext = b ? `
    Age: ${b.age || 'unknown'}
    Sex: ${b.sex || 'unknown'}
    Height: ${b.heightIn ? `${b.heightIn} inches` : 'unknown'}
    Current Weight: ${b.weightLbs ? `${b.weightLbs} lbs` : 'unknown'}
    Goal Weight: ${b.goalWeightLbs ? `${b.goalWeightLbs} lbs` : 'unknown'}
    Activity Level: ${b.activityLevel || 'unknown'}
    Medical Conditions: ${b.medicalConditions?.join(', ') || 'none'}
    Dietary Preferences: ${Array.isArray(b.dietaryPreferences) ? b.dietaryPreferences.join(', ') : JSON.stringify(b.dietaryPreferences || {})}
    Injuries or Limitations: ${b.injuriesOrLimitations?.join(', ') || 'none'}
    Sleep Hours Per Night: ${b.sleepHoursPerNight || 'unknown'}
  ` : 'No biometrics available.';
const goalsContext = goals?.length ? goals.map(g => 
    `- Goal Type: ${g.type}, Target: ${g.target}, Description: ${g.description}`)
    .join('\n') : 'No active goals';

const mealContext = userProfile.mealLogs?.slice(-6).map(m =>
    `- ${m.date} | ${m.mealType}: ${m.description} ${m.calories ? `(${m.calories} cal)` : ''}`
  ).join('\n') || 'No recent meals logged.';
  // - 6 for last two days of meals generally
const progressContext = userProfile.progressEntries?.slice(-5).map(p =>
  `- ${p.date}: ${JSON.stringify(p)}`
).join('\n') || 'No recent progress entries.';

  const systemContext = `
    You are a supportive and knowledgeable health coach.
    Your role is to provide personalized guidance on nutrition and fitness.
    Always recommend consulting a doctor for medical advice and concerns.
    Keep responses concise, actionable, and encouraging.

    USER BIOMETRICS:
    ${biometricsContext}

    USER GOALS:
    ${goalsContext}

    RECENT MEAL LOGS:
    ${mealContext}

    RECENT PROGRESS:
    ${progressContext}
  `.trim();

  return `${systemContext}\n\nUser: ${userMessage}`;

};
export { buildHealthCoachPrompt };

const buildCreateGoalPrompt = ({ userMessage, userProfile = {} }) => {
  const b = userProfile.biometrics || {};

  const biometricsContext = `
Age: ${b.age ?? 'unknown'}
Sex: ${b.sex ?? 'unknown'}
HeightIn: ${b.heightIn ?? 'unknown'}
WeightLbs: ${b.weightLbs ?? 'unknown'}
ActivityLevel: ${b.activityLevel ?? 'unknown'}
MedicalConditions: ${Array.isArray(b.medicalConditions) ? b.medicalConditions.join(', ') : (b.medicalConditions ?? 'none')}
DietaryPreferences: ${Array.isArray(b.dietaryPreferences) ? b.dietaryPreferences.join(', ') : (b.dietaryPreferences ?? 'none')}
InjuriesOrLimitations: ${Array.isArray(b.injuriesOrLimitations) ? b.injuriesOrLimitations.join(', ') : (b.injuriesOrLimitations ?? 'none')}
`.trim();

  const systemContext = `
You are an expert health coach that creates safe, personalized weekly plans.

Hard constraints:
- Respect dietary preferences strictly (e.g. if vegetarian, do not include meat or fish).
- Respect injuries/limitations strictly (avoid exercises that aggravate them).
- If medical conditions exist, provide conservative advice and include a brief "consult clinician" note.

You must produce TWO outputs in this exact order:

1) READABLE PLAN (GitHub-flavored Markdown — this is rendered in the app like the main chat):
   - Start with 1–2 short friendly sentences (can use **bold** for emphasis).
   - Then cover EVERY calendar day **Sunday** through **Saturday** (do not skip a day).
   - For each day, use a clear Markdown structure, for example:
     - A line like **Sunday:** or ### Sunday
     - Under that day, use bullet lists (- item) for meals, exercises, sets/reps, or rest notes.
   - Put a blank line between days so it is easy to scan.
   - Match the style of a structured coach reply: bold labels for days and key ideas, bullets for details.
   - Do NOT put JSON, code fences, or raw "key": value pairs in this section (the JSON comes only in part 2).

2) MACHINE-READABLE GOAL (exactly one fenced block at the very end):
   After the readable plan, output ONE AND ONLY ONE fenced JSON code block:

\`\`\`json
{
  "type": "nutrition" | "fitness" | "weight gain/loss",
  "target": "<concrete target string>",
  "description": "<one short sentence summarizing the goal>",
  "weeklyPlan": {
    "sunday": "<single string: summarize that day’s plan>",
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
- Must include ALL 7 keys under weeklyPlan (sunday … saturday). No omissions.
- Each weeklyPlan value is ONE plain-text string (can be long); summarize that day for storage. Plain text is fine (no Markdown required inside JSON strings).
- Top-level keys must be ONLY: type, target, description, weeklyPlan — nothing else.
- Valid JSON only: double quotes, no trailing commas.

User biometrics/context:
${biometricsContext}
`.trim();

  return `${systemContext}\n\nUser goal request: ${userMessage}`;
};

/** Second pass: turn partial/malformed output into valid Goal JSON only. */
const buildRepairGoalJsonPrompt = ({ userMessage, userProfile = {}, assistantTranscript }) => {
  const b = userProfile.biometrics || {};
  const bio = `
Age: ${b.age ?? 'unknown'}
Sex: ${b.sex ?? 'unknown'}
DietaryPreferences: ${Array.isArray(b.dietaryPreferences) ? b.dietaryPreferences.join(', ') : (b.dietaryPreferences ?? 'none')}
InjuriesOrLimitations: ${Array.isArray(b.injuriesOrLimitations) ? b.injuriesOrLimitations.join(', ') : (b.injuriesOrLimitations ?? 'none')}
`.trim();

  return `
You fix and complete health-coach output into ONE valid JSON object for database storage.

User request: ${userMessage}

Biometrics: ${bio}

Assistant output (may be truncated or malformed):
---
${assistantTranscript}
---

Output ONLY a single fenced JSON block (no other text):
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
- weeklyPlan MUST have all 7 days. If a day is missing from the transcript, infer a reasonable day plan consistent with the rest and biometrics.
- Escape quotes inside strings. Valid JSON only.
`.trim();
};

export { buildCreateGoalPrompt, buildRepairGoalJsonPrompt };

