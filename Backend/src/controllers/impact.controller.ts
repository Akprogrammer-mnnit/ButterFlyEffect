import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ImpactService } from '../services/impact.service.js';
import { generateCompleteImpactReport } from '../services/generate.service.js';
import { analyzeImpact } from '../services/groq.service.js';
import Repository from '../models/Repository.js';

export const getImpactAnalysis = asyncHandler(async (req: Request, res: Response) => {

    const { targetFunctionIds, code, gitUrl } = req.body;

    if (!gitUrl) {
        return res.status(400).json({ error: "gitUrl is required to identify the workspace." });
    }

    const repoRecord = await Repository.findOne({ url: gitUrl });

    if (!repoRecord) {

        return res.status(404).json({
            error: "Repository not found. Please upload to the dashboard."
        });
    }

    const correctRepoId = repoRecord.repoId;

    const impactService = new ImpactService();
    const result = await impactService.analyzeImpact(targetFunctionIds, correctRepoId);

    const codes = await generateCompleteImpactReport(result, code, correctRepoId);
    const report = await analyzeImpact(codes);

    console.log("Report: ", report);

    return res.status(200).json({
        success: true,
        message: "Impact analysis complete",
        data: {
            totalDependencies: codes.affected_nodes.length,
            graphData: result,
            aiReport: report
        }
    });
});