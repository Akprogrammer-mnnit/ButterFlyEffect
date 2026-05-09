import AstNode from '../models/AstNode.js';
import RepoNode from '../models/RepoNode.js'; // 👈 CRITICAL: We must import RepoNode
import { ChangedNode, AffectedNode } from './groq.service.js';

export const generateCompleteImpactReport = async (neo4jPayload: any, newCode: any, repoId: string) => {
    const targetIds = neo4jPayload.analyzedTargets || [];
    const rawDependencies = neo4jPayload.dependencies || [];

    const dependencies = rawDependencies.filter((dep: any) => !targetIds.includes(dep.id));
    const dependencyIds = dependencies.map((dep: any) => dep.id);
    const allIdsToFetch = [...targetIds, ...dependencyIds];

    const dbAstNodes = await AstNode.find({
        id: { $in: allIdsToFetch },
        repoId: repoId
    }).select('-__v').lean();


    const dbRepoNodes = await RepoNode.find({
        path: { $in: allIdsToFetch },
        repoId: repoId
    }).select('+content -__v').lean();

    const nodeMap = new Map();

    dbAstNodes.forEach(node => {
        nodeMap.set(node.id, node);
    });

    dbRepoNodes.forEach(node => {
        nodeMap.set(node.path, {
            id: node.path,
            name: node.name,
            type: 'file',
            file_path: node.path,
            start_line: 1,
            end_line: node.content ? node.content.split('\n').length : 1,
            code: node.content || '// Content missing in database'
        });
    });

    const mainTargetId = targetIds[0];
    const dbTarget = nodeMap.get(mainTargetId);

    const changed_node: ChangedNode = dbTarget ? {
        id: dbTarget.id,
        name: dbTarget.name,
        type: dbTarget.type,
        file_path: dbTarget.file_path,
        start_line: dbTarget.start_line,
        end_line: dbTarget.end_line,
        old_code: dbTarget.code,
        new_code: newCode
    } : {
        id: mainTargetId,
        name: mainTargetId.split('::').pop() || mainTargetId,
        type: 'external',
        file_path: mainTargetId,
        start_line: 0, end_line: 0,
        old_code: '// Target not found in MongoDB',
        new_code: newCode || '// No new code'
    };

    const affected_nodes: AffectedNode[] = dependencies.map((neoNode: any) => {
        const dbNode = nodeMap.get(neoNode.id);

        if (!dbNode) {
            // console.log(`🚨 [STILL MISSING] Neo4j ID: "${neoNode.id}" not found in AstNode OR RepoNode!`);
            return {
                id: neoNode.id,
                name: neoNode.id.split('/').pop() || neoNode.id,
                type: 'file_or_external',
                file_path: neoNode.id,
                start_line: 1, end_line: 1,
                code: '// AST Code unavailable. Graph knows it exists, but DB query failed.',
                relationship: neoNode.relationship || neoNode.type || 'DEPENDS_ON'
            };
        }

        return {
            id: dbNode.id,
            name: dbNode.name || 'unknown',
            type: dbNode.type || 'unknown',
            file_path: dbNode.file_path || neoNode.id,
            start_line: dbNode.start_line || 1,
            end_line: dbNode.end_line || 1,
            code: dbNode.code,
            relationship: neoNode.relationship || neoNode.type || 'DEPENDS_ON'
        };
    });

    return {
        changed_node,
        affected_nodes,
        actualDependencyCount: affected_nodes.length
    };
};