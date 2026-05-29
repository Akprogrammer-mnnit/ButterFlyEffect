import driver from "./index.js";

export interface DependencyResult {
    id: string;
    name: string;
    type: 'Function' | 'File' | 'Unknown';
    depth: number;
}

export class ImpactRepo {
    static async findBlastRadius(targetFunctionIds: string[], repoId: string, maxDepth: number = 5): Promise<DependencyResult[]> {
        const session = driver.session();

        try {
            const query = `
                UNWIND $targetFunctionIds AS targetId
                MATCH (target:Function {id: targetId, repoId: $repoId})
                MATCH p = (target)<-[:CALLS*1..${maxDepth}]-(caller)
                WHERE caller.repoId = $repoId
                RETURN 
                    caller.id AS callerId, 
                    caller.name AS callerName, 
                    labels(caller) AS callerLabels, 
                    min(length(p)) AS depth
                ORDER BY depth ASC
            `;

            let result = await session.run(query, { targetFunctionIds, repoId });

            if (result.records.length === 0) {
                console.log(`[ImpactRepo] No direct CALLS found. Falling back to File scope.`);
                const fileIds = targetFunctionIds.map(id => id.split('::')[0]);

                const fallbackQuery = `
                    UNWIND $fileIds AS fileId
                    MATCH (caller:File {id: fileId, repoId: $repoId})
                    RETURN 
                        caller.id AS callerId, 
                        caller.name AS callerName, 
                        labels(caller) AS callerLabels, 
                        1 AS depth
                `;
                result = await session.run(fallbackQuery, { fileIds, repoId });
            }

            const dependencies: DependencyResult[] = result.records.map(record => {
                const labels = record.get('callerLabels') as string[];
                let type: DependencyResult['type'] = 'Unknown';

                if (labels.includes('Function')) type = 'Function';
                else if (labels.includes('File')) type = 'File';

                const rawDepth = record.get('depth');
                const depth = rawDepth.toNumber ? rawDepth.toNumber() : rawDepth;

                return {
                    id: record.get('callerId') as string,
                    name: record.get('callerName') as string,
                    type,
                    depth
                };
            });

            const uniqueDeps = Array.from(new Map(dependencies.map(item => [item.id, item])).values());
            return uniqueDeps;

        } catch (e: any) {
            console.error(`[ImpactRepo] findBlastRadius failed: ${e.message}`);
            throw e;
        } finally {
            await session.close();
        }
    }
}