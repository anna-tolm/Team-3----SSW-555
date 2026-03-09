//establishes connection to gemini

import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiConfig } from "../../config/aiSettings.js";
//for testing: 
console.log("API KEY:", process.env.GEMINI_API_KEY);
const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const getModel = () => {
    return genAi.getGenerativeModel({
        model: aiConfig.modelName,
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1024,
        },
    });
};
export { getModel };