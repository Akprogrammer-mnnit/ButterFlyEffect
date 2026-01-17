import { Router } from 'express';
import { analyzeRepo } from '../controllers/project.controller';

const router = Router();

router.route("/clone").post(analyzeRepo);

export default router;