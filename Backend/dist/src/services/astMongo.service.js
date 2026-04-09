var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import AstNode from '../models/AstNode.js';
export const saveAstNodesToMongo = (repoId, extractedNodes) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`[MongoDB] Saving ${extractedNodes.length} AST Nodes...`);
        yield AstNode.deleteMany({ repoId });
        const dbNodes = extractedNodes.map(node => ({
            id: node.id, // e.g., 'src/cart.ts::calculateTotal'
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
            yield AstNode.insertMany(dbNodes.slice(i, i + BATCH_SIZE));
        }
        console.log("[MongoDB] Successfully saved AST Nodes.");
    }
    catch (error) {
        console.error("[MongoDB] Error saving AST Nodes:", error);
        throw error;
    }
});
