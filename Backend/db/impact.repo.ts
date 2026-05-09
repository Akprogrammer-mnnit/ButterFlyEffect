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
                MATCH p = (caller {repoId: $repoId})-[:CALLS*1..${maxDepth}]->(target:Function {repoId: $repoId})
                WHERE target.id IN $targetFunctionIds
                RETURN 
                    caller.id AS callerId, 
                    caller.name AS callerName, 
                    labels(caller) AS callerLabels, 
                    min(length(p)) AS depth
                ORDER BY depth ASC
            `;

            const result = await session.run(query, { targetFunctionIds, repoId });

            const dependencies: DependencyResult[] = result.records.map(record => {
                const labels = record.get('callerLabels') as string[];
                let type: DependencyResult['type'] = 'Unknown';

                if (labels.includes('Function')) type = 'Function';
                else if (labels.includes('File')) type = 'File';


                const depth = record.get('depth').toNumber ? record.get('depth').toNumber() : record.get('depth');

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