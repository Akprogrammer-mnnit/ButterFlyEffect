import AstNode from '../models/AstNode';

export const generateCompleteImpactReport = async (neo4jPayload: any) => {
    // 1. Extract the main target ID and all dependency IDs
    const targetIds = neo4jPayload.data.analyzedTargets || [];
    const dependencies = neo4jPayload.data.dependencies || [];
    
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
    
    let changed_node = null;
    if (dbTarget) {
        changed_node = { ...dbTarget };
    } else {
        // Handle cases like "fs::statSync" which is a Node.js core module 
        // and won't exist in your local MongoDB code files.
        changed_node = { 
            id: mainTargetId, 
            message: "This is an external or core module not found in the local repository code." 
        };
    }

    // 5. Format the affected nodes
    const affected_nodes = dependencies.map((neoNode: any) => {
        const dbNode = nodeMap.get(neoNode.id);
        
        // If the code isn't in MongoDB, skip it
        if (!dbNode) return null;

        // Combine the MongoDB data with the Neo4j data (like depth)
        return {
            ...dbNode,           // Adds id, name, type, file_path, start_line, end_line, code
            depth: neoNode.depth // Keeps the depth info from Neo4j
        };
    }).filter(Boolean); // Clean out any nulls

    // 6. Return the final structured object
    return {
        changed_node,
        affected_nodes
    };
};