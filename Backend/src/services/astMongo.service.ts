import mongoose from 'mongoose';
import AstNode from '../models/AstNode';

export const saveAstNodesToMongo = async (repoId: mongoose.Types.ObjectId | string, extractedNodes: any[]) => {
    try {
        console.log(`[MongoDB] Saving ${extractedNodes.length} AST Nodes...`);

        await AstNode.deleteMany({ repoId });

        const dbNodes = extractedNodes.map(node => ({
            id: node.id,                 // e.g., 'src/cart.ts::calculateTotal'
            repoId: repoId,
            name: node.name,
            type: node.label || node.type, // Handle depending on how you named it for Neo4j
            file_path: node.file_path || "unknown", 
            start_line: node.start_line || 0,
            end_line: node.end_line || 0,
            code: node.code || "Code not available"
        }));

        const BATCH_SIZE = 1000;
        for (let i = 0; i < dbNodes.length; i += BATCH_SIZE) {
            await AstNode.insertMany(dbNodes.slice(i, i + BATCH_SIZE));
        }

        console.log("[MongoDB] Successfully saved AST Nodes.");
    } catch (error) {
        console.error("[MongoDB] Error saving AST Nodes:", error);
        throw error;
    }
};