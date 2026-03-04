//establishes connection to gemini

import { GoogleGenerativeAI } from "@google/generative-ai";
const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const getModel = () => {
    return genAi.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1024,
        },
    });
};
export { getModel };