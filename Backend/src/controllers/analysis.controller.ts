import { Request, Response } from 'express';
import { generateCompleteImpactReport } from '../services/generate.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const getImpactAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const neo4jPayload = req.body;
  console.log(neo4jPayload);
  if (!neo4jPayload || !neo4jPayload.data || !neo4jPayload.data.dependencies) {
    throw new ApiError(400, "Invalid Neo4j payload format provided in request body.");
  }

  const completeData = await generateCompleteImpactReport(neo4jPayload, "");

  res.status(200).json(completeData);
});
import { analyzeImpact, ImpactAnalysisInput } from '../services/groq.service.js';

export const analyzeCodeImpact = async (req: Request, res: Response): Promise<void> => {
  try {
    const input: ImpactAnalysisInput = req.body;

    // validating input
    if (!input.changed_node) {
      res.status(400).json({ error: 'changed_node is required' });
      return;
    }

    if (!input.affected_nodes || !Array.isArray(input.affected_nodes)) {
      res.status(400).json({ error: 'affected_nodes must be an array' });
      return;
    }

    if (!input.changed_node.old_code || !input.changed_node.new_code) {
      res.status(400).json({ error: 'both old_code and new_code are required in changed_node' });
      return;
    }

    if (input.affected_nodes.some((n: any) => !n.code)) {
      res.status(400).json({ error: 'code snippet is required for all affected_nodes' });
      return;
    }

    const result = await analyzeImpact(input);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
