import { ImpactRepo } from '../../db/impact.repo.js';
import { ApiError } from '../utils/apiError.js';

export class ImpactService {

    async analyzeImpact(targetFunctionIds: string[], repoId: string) {
        if (!targetFunctionIds || !Array.isArray(targetFunctionIds) || targetFunctionIds.length === 0) {
            throw new ApiError(400, "Please provide an array of targetFunctionIds.");
        }

        const expandedIds: string[] = [];

        targetFunctionIds.forEach(id => {
            expandedIds.push(id);

            if (id.includes('.ts::')) expandedIds.push(id.replace('.ts::', '.js::'));
            if (id.includes('.tsx::')) expandedIds.push(id.replace('.tsx::', '.js::'));
            if (id.endsWith('.ts')) expandedIds.push(id.replace(/\.ts$/, '.js'));
            if (id.endsWith('.tsx')) expandedIds.push(id.replace(/\.tsx$/, '.js'));
        });

        console.log("Analyzing expanded IDs in Neo4j:", expandedIds);

        const dependencies = await ImpactRepo.findBlastRadius(expandedIds, repoId);

        console.log(`[ImpactService] Found ${dependencies.length} dependent nodes.`);

        return {
            analyzedTargets: targetFunctionIds,
            totalDependencies: dependencies.length,
            dependencies: dependencies
        };
    }
}