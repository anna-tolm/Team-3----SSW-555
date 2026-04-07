//establishes connection to gemini
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiConfig } from "../../config/aiSettings.js";
const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const getModel = () => {
    return genAi.getGenerativeModel({
        model: aiConfig.modelName,
        generationConfig: {
            temperature: 0.5,
            // Weekly plan + JSON can exceed 1024 tokens.
            maxOutputTokens: 4096,
        },
    });
};
export { getModel };