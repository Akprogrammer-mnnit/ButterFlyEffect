import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import repoRoutes from './routes/repo.route.js';

const app: Application = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import projectRouter from './routes/project.route.js'
app.use('/api', projectRouter);
app.use('/api/repo', repoRoutes);
import analysisRouter from './routes/analysis.route.js';
app.use('/api', analysisRouter);
import impactRouter from './routes/impact.route.js'
app.use('/api/impact', impactRouter);

export default app;
