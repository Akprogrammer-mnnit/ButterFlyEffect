import express, {Application, Request,Response} from 'express'
import cors from 'cors'

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

import projectRouter from './routes/project.route'
app.use('/api',projectRouter);

import analysisRouter from './routes/analysis.route';
app.use('/api', analysisRouter);

import impactRouter from './routes/impact.route'
app.use('/api/impact', impactRouter);

export default app;