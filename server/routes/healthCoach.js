import express from "express";
import { getHealthCoachResponse } from '../services/gemini/healthCoach.js';
const router = express.Router();


router.post('/chat', async (req, res) => {
    const { message, userId } = req.body;
    if(!message){
        return res.status(400).json({error: 'Message required!'});

    }
    if(!userId){
        return res.status(400).json({error: 'User id is required!'});
    }
    const response = await getHealthCoachResponse({ userMessage: message, userId});
    res.json(response);
});
export default router;

