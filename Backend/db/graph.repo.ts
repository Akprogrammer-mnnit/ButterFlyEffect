import driver from "./index.js";


const CHUNK_SIZE = 1000
export class GraphRepo {
    static async batchWrite(nodes: any[], edges: any[], repoId: string) {
        const session = driver.session();

        const tx = session.beginTransaction();
        try {
            await tx.run(`
                MATCH (n)
                WHERE n.repoId = $repoId AND any(label IN labels(n) WHERE label IN ['File', 'Function', 'Service'])
                DETACH DELETE n
            `, { repoId });
            console.log('Cleared old nodes and relationships.');
        } catch (e) {
            console.error('Error clearing old nodes:', e);
        }

        const activeLabels = ['File', 'Function', 'Service'];
        const activeEdgeTypes = ['DEFINES', 'CALLS'];

        try {
            console.log(`Processing ${nodes.length} nodes and ${edges.length} edges..`);

            for (const label of activeLabels) {
                const labelNodes = nodes.filter(n => n.label === label);
                for (let i = 0; i < labelNodes.length; i += CHUNK_SIZE) {
                    const batch = labelNodes.slice(i, i + CHUNK_SIZE);
                    await tx.run(`
            UNWIND $batch AS node
            MERGE (n:${label} {id: node.id, repoId: $repoId})
            SET n.name = node.name, n.startLine = node.startLine, n.endLine = node.endLine
        `, { batch, repoId });
                }
            }

            for (const type of activeEdgeTypes) {
                const typeEdges = edges.filter(e => e.type === type);
                for (let i = 0; i < typeEdges.length; i += CHUNK_SIZE) {
                    const batch = typeEdges.slice(i, i + CHUNK_SIZE);
                    await tx.run(`
            UNWIND $batch AS edge
            MATCH (source {id: edge.from, repoId: $repoId})
            MATCH (target {id: edge.to, repoId: $repoId})
            MERGE (source)-[:${type}]->(target)
        `, { batch, repoId });
                }
            }

            await tx.commit();
            console.log("Batch write complete and committed.");

        } catch (e: any) {
            console.error(`batchWrite failed: ${e}`);
            await tx.rollback();
        } finally {
            await session.close();
        }
    }
}