// AI (Gemini) configuration. Only GEMINI_API_KEY is required in .env.
export const aiConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  modelName: process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash',
};
