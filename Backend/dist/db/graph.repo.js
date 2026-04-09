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
export class GraphRepo {
    static batchWrite(nodes, edges) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = driver.session();
            // Delete all File, Function, and Service nodes and their relationships before inserting new ones
            try {
                yield session.run(`
                MATCH (n)
                WHERE any(label IN labels(n) WHERE label IN ['File', 'Function', 'Service'])
                DETACH DELETE n
            `);
                console.log('Cleared old nodes and relationships.');
            }
            catch (e) {
                console.error('Error clearing old nodes:', e);
            }
            const activeLabels = ['File', 'Function', 'Service'];
            const activeEdgeTypes = ['DEFINES', 'CALLS'];
            try {
                console.log(`Processing ${nodes.length} nodes and ${edges.length} edges..`);
                for (const label of activeLabels) {
                    const batch = nodes.filter(n => n.label === label);
                    if (batch.length > 0) {
                        yield session.run(`
            UNWIND $batch AS node
            MERGE (n:${label} {id: node.id})
            SET n.name = node.name,
                n.startLine = node.startLine,
                n.endLine = node.endLine
        `, { batch });
                    }
                }
                for (const type of activeEdgeTypes) {
                    const batch = edges.filter(e => e.type === type);
                    if (batch.length > 0) {
                        yield session.run(`
                        UNWIND $batch AS edge
                        MATCH (source {id: edge.from})
                        MATCH (target {id: edge.to})
                        MERGE (source)-[:${type}]->(target)
                    `, { batch });
                    }
                }
                console.log("Batch write complete..");
            }
            catch (e) {
                console.error(`batchWrite failed: ${e}`);
            }
            finally {
                yield session.close();
            }
        });
    }
}
