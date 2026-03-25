// AI (Gemini) configuration. Only GEMINI_API_KEY is required in .env.
import dotenv from 'dotenv';
dotenv.config();
export const aiConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
};
