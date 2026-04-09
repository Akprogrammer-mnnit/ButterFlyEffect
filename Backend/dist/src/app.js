import express from 'express';
import cors from 'cors';
import repoRoutes from './routes/repo.route.js';
import { connectMongoDB } from '../db/mongo.js';
// Mount the routes so the frontend can access them
const app = express();
connectMongoDB();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import projectRouter from './routes/project.route.js';
app.use('/api', projectRouter);
app.use('/api/repo', repoRoutes);
import analysisRouter from './routes/analysis.route.js';
app.use('/api', analysisRouter);
import impactRouter from './routes/impact.route.js';
app.use('/api/impact', impactRouter);
export default app;
