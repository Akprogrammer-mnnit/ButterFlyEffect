
import { ImpactRepo } from '../../db/impact.repo.js';
import { ApiError } from '../utils/apiError.js';

export class ImpactService {

    async analyzeImpact(targetFunctionIds: string[], repoId: string) {
        if (!targetFunctionIds || !Array.isArray(targetFunctionIds) || targetFunctionIds.length === 0) {
            throw new ApiError(400, "Please provide an array of targetFunctionIds.");
        }

        console.log("Analyzing exact IDs in Neo4j:", targetFunctionIds);

        const dependencies = await ImpactRepo.findBlastRadius(targetFunctionIds, repoId);

        console.log(`[ImpactService] Found ${dependencies.length} dependent nodes.`);

        return {
            analyzedTargets: targetFunctionIds,
            totalDependencies: dependencies.length,
            dependencies: dependencies
        };
    }
}