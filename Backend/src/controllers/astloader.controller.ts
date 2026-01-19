import { Session } from 'neo4j-driver';
import driver, { getSession } from '../../db/index'; 
import { ApiError } from '../utils/apiError';

export class AstLoader {

    
    async batchWrite(nodes: any[], edges: any[]) {
        const session = getSession();
        console.log(`🔄 [Loader] Starting batch write. Nodes: ${nodes.length}, Edges: ${edges.length}`);
        
        try {

            if (nodes.length > 0) {
                console.log(`   ⏳ [Loader] Writing ${nodes.length} Nodes...`);
                await session.run(`
                    UNWIND $batch AS node
                    MERGE (n:Entity {id: node.id})
                    SET n.name = node.name, n.type = node.label
                    
                    // Dynamic Labeling
                    FOREACH (_ IN CASE WHEN node.label = 'File' THEN [1] ELSE [] END | SET n:File)
                    FOREACH (_ IN CASE WHEN node.label = 'Function' THEN [1] ELSE [] END | SET n:Function)
                    FOREACH (_ IN CASE WHEN node.label = 'Service' THEN [1] ELSE [] END | SET n:Service)
                    FOREACH (_ IN CASE WHEN node.label = 'Import' THEN [1] ELSE [] END | SET n:Import)
                `, { batch: nodes });
            }

            if (edges.length > 0) {
                console.log(`   ⏳ [Loader] Writing ${edges.length} Edges...`);
                await session.run(`
                    UNWIND $batch AS edge
                    MATCH (source {id: edge.from})
                    MERGE (target {id: edge.to})
                    
                    // Dynamic Relationships
                    FOREACH (_ IN CASE WHEN edge.type = 'DEFINES' THEN [1] ELSE [] END | 
                        MERGE (source)-[:DEFINES]->(target)
                    )
                    FOREACH (_ IN CASE WHEN edge.type = 'CALLS' THEN [1] ELSE [] END | 
                        MERGE (source)-[:CALLS]->(target)
                    )
                    FOREACH (_ IN CASE WHEN edge.type = 'IMPORTS' THEN [1] ELSE [] END | 
                        MERGE (source)-[:IMPORTS]->(target)
                    )
                `, { batch: edges });
            }

            console.log(`✅ [Loader] Batch write complete.`);
            
        } catch (dbError: any) {
            console.error("❌ [Loader] Database Operation Failed", dbError); 
            throw new ApiError(500, "Database batch write failed", [dbError.message]);
        } finally {
            await session.close();
        }
    }

    async closeDriver() {
        await driver.close();
    }
}