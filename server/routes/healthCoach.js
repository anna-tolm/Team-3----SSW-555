import express from "express";
import {
    getHealthCoachResponse,
    getCreateGoalResponse,
    getNutritionEstimateResponse,
    runCreateGoalStream
} from '../services/gemini/healthCoach.js';
const router = express.Router();

//POST for routing messages in chat to AI
router.post('/chat', async (req, res) => {
    try {
        const { message, userId } = req.body;
        if(!message){
            return res.status(400).json({error: 'Message required!'});

        }
        if(!userId){
            return res.status(400).json({error: 'User id is required!'});
        }
        const response = await getHealthCoachResponse({ userMessage: message, userId});
        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
    }
});

// POST /api/health-coach/create-goal - generate a goal plan + Goal JSON
router.post('/create-goal', async (req, res) => {
    try {
        const { message, userId } = req.body;
        if(!message){
            return res.status(400).json({error: 'Message required!'});
        }
        if(!userId){
            return res.status(400).json({error: 'User id is required!'});
        }
        const response = await getCreateGoalResponse({ userMessage: message, userId});
        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
    }
});

router.post('/estimate-nutrition', async (req, res) => {
    try {
        const { message, userId, date } = req.body;
        if(!message){
            return res.status(400).json({error: 'Message required!'});
        }
        if(!userId){
            return res.status(400).json({error: 'User id is required!'});
        }
        if(!date){
            return res.status(400).json({error: 'Date is required!'});
        }
        const response = await getNutritionEstimateResponse({ userMessage: message, userId, date });
        if (!response.success && !response.nutritionJson) {
            return res.status(400).json(response);
        }
        res.json(response);
    } catch (e) {
        res.status(400).json({ error: e?.message ?? String(e) });
    }
});

// POST /api/health-coach/create-goal/stream
// Streams deltas as SSE: {type:"delta", text:"..."} then final: {type:"done", fullText:"...", goalJson:{...}|null}
router.post('/create-goal/stream', async (req, res) => {
    const { message, userId } = req.body;
    if(!message){
        return res.status(400).json({error: 'Message required!'});
    }
    if(!userId){
        return res.status(400).json({error: 'User id is required!'});
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Best-effort flush for proxies.
    res.write('\n');

    try {
        const { fullText, displayText, goalJson } = await runCreateGoalStream({
            userMessage: message,
            userId,
            onDelta: (t) => {
                res.write(`data: ${JSON.stringify({ type: 'delta', text: t })}\n\n`);
            },
            onRepairStart: () => {
                res.write(
                    `data: ${JSON.stringify({
                        type: 'status',
                        message: 'Finalizing goal JSON (filling any missing days)...'
                    })}\n\n`
                );
            }
        });

        res.write(
            `data: ${JSON.stringify({
                type: 'done',
                fullText,
                displayText,
                goalJson
            })}\n\n`
        );
        res.end();
    } catch (e) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: e?.message ?? String(e) })}\n\n`);
        res.end();
    }
});
export default router;

