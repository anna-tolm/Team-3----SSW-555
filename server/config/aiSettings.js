import { GoogleGenerativeAI } from '@google/generative-ai';

// AI (Gemini) configuration. Only GEMINI_API_KEY is required in .env / environment.
export const aiConfig = {
  apiKey: process.env.GEMINI_API_KEY || '',
  modelName: process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash',
};

export const getGeminiClient = () => {
  if (!aiConfig.apiKey) return null;
  return new GoogleGenerativeAI(aiConfig.apiKey);
};
