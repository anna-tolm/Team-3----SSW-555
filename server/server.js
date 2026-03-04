import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import healthCoachRoutes from './routes/healthCoach.js';
dotenv.config();
const app = express();



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/health-coach', healthCoachRoutes);
//import constructorMethod from './routes/index.js';

//app.use(express.json());
//constructorMethod(app);
app.listen(3000, () => {
  console.log("We've now got a server!");
  console.log('Your routes will be running on http://localhost:3000');
});
