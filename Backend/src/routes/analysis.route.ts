import { Router } from 'express';
<<<<<<< HEAD
import { getImpactAnalysis } from '../controllers/analysis.controller';

const router = Router();

router.post('/impact', getImpactAnalysis);
=======
import { analyzeCodeImpact } from '../controllers/analysis.controller';

const router = Router();

router.post('/analyze', analyzeCodeImpact);
>>>>>>> fc513b8f81ebc722b856ce4ad98a667576a29db6

export default router;