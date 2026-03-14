import driver from "./index";

export class GraphRepo {
    static async batchWrite(nodes: any[], edges: any[]) {
        const session = driver.session();

        // Delete all File, Function, and Service nodes and their relationships before inserting new ones
        try {
            await session.run(`
                MATCH (n)
                WHERE any(label IN labels(n) WHERE label IN ['File', 'Function', 'Service'])
                DETACH DELETE n
            `);
            console.log('Cleared old nodes and relationships.');
        } catch (e) {
            console.error('Error clearing old nodes:', e);
        }

        const activeLabels = ['File', 'Function', 'Service'];
        const activeEdgeTypes = ['DEFINES', 'CALLS'];

        try {
            console.log(`Processing ${nodes.length} nodes and ${edges.length} edges..`);

            for (const label of activeLabels) {
                const batch = nodes.filter(n => n.label === label);

                if (batch.length > 0) {
                    await session.run(`
                        UNWIND $batch AS node
                        MERGE (n:${label} {id: node.id})
                        SET n.name = node.name
                    `, { batch });
                }
            }

            for (const type of activeEdgeTypes) {
                const batch = edges.filter(e => e.type === type);

                if (batch.length > 0) {
                    await session.run(`
                        UNWIND $batch AS edge
                        MATCH (source {id: edge.from})
                        MATCH (target {id: edge.to})
                        MERGE (source)-[:${type}]->(target)
                    `, { batch });
                }
            }

            console.log("Batch write complete..");

        } catch (e: any) {
            console.error(`batchWrite failed: ${e}`);
        } finally {
            await session.close();
        }
    }
}