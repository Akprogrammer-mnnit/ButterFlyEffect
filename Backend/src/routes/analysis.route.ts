import { Router } from 'express';
import { getImpactAnalysis } from '../controllers/analysis.controller';

const router = Router();

router.post('/impact', getImpactAnalysis);

export default router;