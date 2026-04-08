import express, {Application, Request,Response} from 'express'
import cors from 'cors'
import repoRoutes from './routes/repo.route';
import { connectMongoDB } from '../db/mongo';
import analysisRoutes from './routes/analysis.route';
// Mount the routes so the frontend can access them
const app: Application = express();
connectMongoDB()
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

import projectRouter from './routes/project.route'
app.use('/api',projectRouter);
app.use('/api/repo', repoRoutes);
app.use('/api/analysis', analysisRoutes);
export default app;