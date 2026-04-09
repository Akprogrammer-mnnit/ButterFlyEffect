import { ImpactRepo } from '../../db/impact.repo.js';
import { ApiError } from '../utils/apiError.js';

export class ImpactService {

    async analyzeImpact(targetFunctionIds: string[]) {
        if (!targetFunctionIds || !Array.isArray(targetFunctionIds) || targetFunctionIds.length === 0) {
            throw new ApiError(400, "Please provide an array of targetFunctionIds.");
        }

        console.log(`[ImpactService] Finding blast radius for:`, targetFunctionIds);

        // Step 1: Query Neo4j for the dependencies
        const dependencies = await ImpactRepo.findBlastRadius(targetFunctionIds);

        console.log(`[ImpactService] Found ${dependencies.length} dependent nodes.`);

        return {
            analyzedTargets: targetFunctionIds,
            totalDependencies: dependencies.length,
            dependencies: dependencies
        };
    }
}