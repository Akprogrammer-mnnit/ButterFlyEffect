import { Router } from 'express';
import { getImpactAnalysis } from '../controllers/impact.controller';

const router = Router();

router.route("/analyze").post(getImpactAnalysis);

export default router;