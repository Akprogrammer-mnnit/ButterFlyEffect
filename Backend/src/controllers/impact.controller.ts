import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ImpactService } from '../services/impact.service';

export const getImpactAnalysis = asyncHandler(async (req: Request, res: Response) => {
    // Expecting JSON: { "targetFunctionIds": ["id1","id2"..] }
    const { targetFunctionIds } = req.body;

    const impactService = new ImpactService();
    const result = await impactService.analyzeImpact(targetFunctionIds);

    return res.status(200).json({
        success: true,
        message: "Graph dependencies retrieved successfully",
        data: result
    });
});