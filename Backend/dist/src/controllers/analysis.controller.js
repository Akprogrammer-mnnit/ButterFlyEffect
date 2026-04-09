var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { generateCompleteImpactReport } from '../services/generate.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
export const getImpactAnalysis = asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const neo4jPayload = req.body;
    console.log(neo4jPayload);
    if (!neo4jPayload || !neo4jPayload.data || !neo4jPayload.data.dependencies) {
        throw new ApiError(400, "Invalid Neo4j payload format provided in request body.");
    }
    const completeData = yield generateCompleteImpactReport(neo4jPayload);
    res.status(200).json(completeData);
}));
import { analyzeImpact } from '../services/groq.service.js';
export const analyzeCodeImpact = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const input = req.body;
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
        if (input.affected_nodes.some((n) => !n.code)) {
            res.status(400).json({ error: 'code snippet is required for all affected_nodes' });
            return;
        }
        const result = yield analyzeImpact(input);
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
