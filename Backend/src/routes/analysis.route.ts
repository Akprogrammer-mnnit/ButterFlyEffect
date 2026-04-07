import { Router } from 'express';
import { analyzeCodeImpact } from '../controllers/analysis.controller';

const router = Router();

router.post('/analyze', analyzeCodeImpact);

export default router;