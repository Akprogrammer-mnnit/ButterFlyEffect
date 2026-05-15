import express, { Application, Request, Response } from 'express'
import cors from 'cors'

const app: Application = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import projectRouter from './routes/project.route.js'
app.use('/api', projectRouter);
import impactRouter from './routes/impact.route.js'
app.use('/api/impact', impactRouter);

export default app;
