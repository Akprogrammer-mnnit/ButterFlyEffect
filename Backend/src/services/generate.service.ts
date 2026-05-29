import AstNode from '../models/AstNode.js';
import { ChangedNode, AffectedNode } from './groq.service.js';

export const generateCompleteImpactReport = async (neo4jPayload: any, newCode: any, repoId: string) => {
    const targetIds = neo4jPayload.analyzedTargets || [];
    const rawDependencies = neo4jPayload.dependencies || [];
    const dependencies = rawDependencies.filter((dep: any) => !targetIds.includes(dep.id));

    const MAX_LLM_NODES = 30;
    const MAX_CODE_NODES = 10;

    const dependenciesForLLM = dependencies.slice(0, MAX_LLM_NODES);
    const dependencyIds = dependenciesForLLM.map((dep: any) => dep.id);

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

    const affected_nodes: AffectedNode[] = dependenciesForLLM.map((neoNode: any, index: number) => {
        const dbNode = nodeMap.get(neoNode.id);
        const includeCode = index < MAX_CODE_NODES;

        if (!dbNode) {
            return {
                id: neoNode.id,
                name: neoNode.id.split('/').pop() || neoNode.id,
                type: 'file_or_external',
                file_path: neoNode.id,
                start_line: 1, end_line: 1,
                code: '// AST Code unavailable.',
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
            code: includeCode ? dbNode.code : '// Source code omitted to prevent token limit overflow. Please rely on function name and relationship.',
            relationship: neoNode.relationship || neoNode.type || 'DEPENDS_ON'
        };
    });

    return {
        changed_node,
        affected_nodes,
        total_graph_dependencies: dependencies.length
    };
};