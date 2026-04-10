import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ImpactService } from '../services/impact.service.js';
import { generateCompleteImpactReport } from '../services/generate.service.js';
import { analyzeImpact } from '../services/groq.service.js';
import { ImpactAnalysisInput } from '../services/groq.service.js';
export const getImpactAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { targetFunctionIds, code } = req.body;

    const impactService = new ImpactService();
    const result = await impactService.analyzeImpact(targetFunctionIds);
    const codes = await generateCompleteImpactReport(result, code);

    const report = await analyzeImpact(codes);
    console.log("Report: ", report);

    return res.status(200).json({
        success: true,
        message: "Impact analysis complete",
        data: {
            totalDependencies: result.totalDependencies,
            graphData: result,
            aiReport: report
        }
    });

});