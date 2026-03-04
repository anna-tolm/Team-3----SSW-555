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
    Dietary Preferences: ${JSON.stringify(b.dietaryPreferences || {})}
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

