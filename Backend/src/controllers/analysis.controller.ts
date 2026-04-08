import { Request, Response } from 'express';
import { generateCompleteImpactReport } from '../services/generate.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/apiError';

export const getImpactAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const neo4jPayload = req.body;
    console.log(neo4jPayload);
    if (!neo4jPayload || !neo4jPayload.data || !neo4jPayload.data.dependencies) {
        throw new ApiError(400, "Invalid Neo4j payload format provided in request body.");
    }

    const completeData = await generateCompleteImpactReport(neo4jPayload);

    res.status(200).json(completeData);
});