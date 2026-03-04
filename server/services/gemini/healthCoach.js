//calls gemini using model + promp, returns response

import { getModel } from "./client.js";
import { buildHealthCoachPrompt } from "./prompts.js";
import { getUserById } from '../../data/users.js';
import { getGoalsByUserId } from '../../data/goals.js';

const getHealthCoachResponse = async ({ userMessage, userId }) => {
  try {
    const model = getModel();

    // TEMP: hardcoded test profile, remove later
    const userProfile = {
      biometrics: {
        age: 25,
        sex: 'female',
        weightLbs: 150,
        goalWeightLbs: 135,
        activityLevel: 'moderate',
        medicalConditions: [],
        dietaryPreferences: { vegetarian: false, vegan: false },
        injuriesOrLimitations: []
      },
      mealLogs: [],
      progressEntries: []
    };
    const goals = [{ type: 'weight', target: '135lbs', description: 'lose weight' }];

    const prompt = buildHealthCoachPrompt({ userMessage, userProfile, goals });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return { success: true, message: response };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
};



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
export { getHealthCoachResponse };