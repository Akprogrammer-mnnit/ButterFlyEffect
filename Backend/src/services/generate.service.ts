import AstNode from '../models/AstNode.js';
import { ChangedNode, AffectedNode } from './groq.service.js';

export const generateCompleteImpactReport = async (neo4jPayload: any, newCode: any, repoId: string) => {
    const targetIds = neo4jPayload.analyzedTargets || [];
    const rawDependencies = neo4jPayload.dependencies || [];

    const dependencies = rawDependencies.filter((dep: any) => !targetIds.includes(dep.id));
    const dependencyIds = dependencies.map((dep: any) => dep.id);

    const allIdsToFetch = [...targetIds, ...dependencyIds].flatMap(id => {
        if (id.includes('.js::')) return [id, id.replace('.js::', '.ts::'), id.replace('.js::', '.tsx::')];
        if (id.endsWith('.js')) return [id, id.replace(/\.js$/, '.ts'), id.replace(/\.js$/, '.tsx')];
        return [id];
    });

    const dbAstNodes = await AstNode.find({
        id: { $in: allIdsToFetch },
        repoId: repoId
    }).select('-__v').lean();

    const nodeMap = new Map();
    dbAstNodes.forEach(node => {
        nodeMap.set(node.id, node);

        if (node.id.includes('.ts::')) nodeMap.set(node.id.replace('.ts::', '.js::'), node);
        if (node.id.endsWith('.ts')) nodeMap.set(node.id.replace(/\.ts$/, '.js'), node);
    });

    const mainTargetId = targetIds[0];

    let dbTarget = nodeMap.get(mainTargetId) || nodeMap.get(mainTargetId.replace('.ts', '.js'));

    if (!dbTarget && mainTargetId.includes('::')) {
        const filePathOnly = mainTargetId.split('::')[0];
        dbTarget = nodeMap.get(filePathOnly);
        if (dbTarget) console.log(`[Generate Service] Fell back to file scope for target: ${filePathOnly}`);
    }

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
            console.log(`🚨 [STILL MISSING] Neo4j ID: "${neoNode.id}"`);
            return {
                id: neoNode.id,
                name: neoNode.id.split('/').pop() || neoNode.id,
                type: 'file_or_external',
                file_path: neoNode.id,
                start_line: 1, end_line: 1,
                code: '// AST Code unavailable. Graph knows it exists, but MongoDB query failed.',
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