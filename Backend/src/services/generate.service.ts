import AstNode from '../models/AstNode.js';
import { ChangedNode } from './groq.service.js';
export const generateCompleteImpactReport = async (neo4jPayload: any, newCode: any) => {
    // 1. Extract the main target ID and all dependency IDs
    const targetIds = neo4jPayload.analyzedTargets || [];
    const dependencies = neo4jPayload.dependencies || [];
    const dependencyIds = dependencies.map((dep: any) => dep.id);
    const allIdsToFetch = [...targetIds, ...dependencyIds];

    // 2. Fetch ALL matching nodes from MongoDB in one query
    // .lean() converts Mongoose documents to plain JavaScript objects
    const dbNodes = await AstNode.find({ id: { $in: allIdsToFetch } }).select('-__v').lean();

    // 3. Create a Map for instant lookups by ID
    const nodeMap = new Map();
    dbNodes.forEach(node => nodeMap.set(node.id, node));

    // 4. Format the main target node
    const mainTargetId = targetIds[0];
    const dbTarget = nodeMap.get(mainTargetId);

    let changed_node: ChangedNode;

    if (dbTarget) {
        changed_node = {
            id: dbTarget.id,
            name: dbTarget.name,
            type: dbTarget.type,
            file_path: dbTarget.file_path,
            start_line: dbTarget.start_line,
            end_line: dbTarget.end_line,
            old_code: dbTarget.code,
            new_code: newCode
        };
    } else {
        // Fallback for external/core modules that satisfies the ChangedNode interface
        changed_node = {
            id: mainTargetId,
            name: mainTargetId.split('::').pop() || mainTargetId, // Attempts to get a readable name
            type: 'external',
            file_path: 'external/core-module',
            start_line: 0,
            end_line: 0,
            old_code: '// External or core module not found in local repository.',
            new_code: newCode || '// No new code provided.'
        };
    }

    // 5. Format the affected nodes
    const affected_nodes = dependencies.map((neoNode: any) => {
        const dbNode = nodeMap.get(neoNode.id);

        // If the code isn't in MongoDB, skip it
        if (!dbNode) return null;

        // Combine the MongoDB data with the Neo4j data (like depth)
        // We strip _id and repoId here if you want to keep the output clean
        const { _id, repoId, ...cleanDbNode } = dbNode;

        return {
            ...cleanDbNode,      // Adds id, name, type, file_path, start_line, end_line, code
            depth: neoNode.depth // Keeps the depth info from Neo4j
        };
    }).filter(Boolean); // Clean out any nulls

    // 6. Return the final structured object
    return {
        changed_node,
        affected_nodes
    };
};