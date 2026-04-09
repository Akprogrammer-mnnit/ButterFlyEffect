var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ImpactRepo } from '../../db/impact.repo.js';
import { ApiError } from '../utils/apiError.js';
export class ImpactService {
    analyzeImpact(targetFunctionIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!targetFunctionIds || !Array.isArray(targetFunctionIds) || targetFunctionIds.length === 0) {
                throw new ApiError(400, "Please provide an array of targetFunctionIds.");
            }
            console.log(`[ImpactService] Finding blast radius for:`, targetFunctionIds);
            // Step 1: Query Neo4j for the dependencies
            const dependencies = yield ImpactRepo.findBlastRadius(targetFunctionIds);
            console.log(`[ImpactService] Found ${dependencies.length} dependent nodes.`);
            return {
                analyzedTargets: targetFunctionIds,
                totalDependencies: dependencies.length,
                dependencies: dependencies
            };
        });
    }
}
