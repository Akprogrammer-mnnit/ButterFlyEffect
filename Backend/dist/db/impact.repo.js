var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import driver from "./index.js";
export class ImpactRepo {
    static findBlastRadius(targetFunctionIds_1) {
        return __awaiter(this, arguments, void 0, function* (targetFunctionIds, maxDepth = 5) {
            const session = driver.session();
            try {
                const query = `
                MATCH p = (caller)-[:CALLS*1..${maxDepth}]->(target:Function)
                WHERE target.id IN $targetFunctionIds
                RETURN 
                    caller.id AS callerId, 
                    caller.name AS callerName, 
                    labels(caller) AS callerLabels,
                    min(length(p)) AS depth
                ORDER BY depth ASC
            `;
                const result = yield session.run(query, { targetFunctionIds });
                const dependencies = result.records.map(record => {
                    const labels = record.get('callerLabels');
                    let type = 'Unknown';
                    if (labels.includes('Function'))
                        type = 'Function';
                    else if (labels.includes('File'))
                        type = 'File';
                    // We handle neo4j integers safely
                    const depth = record.get('depth').toNumber ? record.get('depth').toNumber() : record.get('depth');
                    return {
                        id: record.get('callerId'),
                        name: record.get('callerName'),
                        type,
                        depth
                    };
                });
                // Deduplicate by ID (in case multiple paths found the same caller)
                const uniqueDeps = Array.from(new Map(dependencies.map(item => [item.id, item])).values());
                return uniqueDeps;
            }
            catch (e) {
                console.error(`[ImpactRepo] findBlastRadius failed: ${e.message}`);
                throw e;
            }
            finally {
                yield session.close();
            }
        });
    }
}
