import { Router } from 'express';
import { getImpactAnalysis } from '../controllers/analysis.controller.js';
import { analyzeCodeImpact } from '../controllers/analysis.controller.js';
const router = Router();
router.post('/impact', getImpactAnalysis);
router.post('/analyze', analyzeCodeImpact);
export default router;
