import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GraphRepo } from '../../db/graph.repo.js';
import { ApiError } from '../utils/apiError.js';
import { v4 as uuidv4 } from 'uuid';

interface AstNode {
    type: string;
    text?: string;
    startRow?: number;
    endRow?: number;
    children?: AstNode[];
}

export class AstService {
    async processAstData(rawAstData: any[], repoId: string = uuidv4()) {
        try {
            if (!rawAstData || rawAstData.length === 0) {
                throw new ApiError(404, `No AST data provided`);
            }

            const validFileIds = new Set<string>();
            for (const data of rawAstData) {
                validFileIds.add(data.fileId.replace(/\.json$/, '').replace(/\\/g, '/'));
            }

            const uniqueNodes = new Map<string, any>();
            const uniqueEdges = new Map<string, any>();
            const fileImports = new Map<string, Map<string, string>>();
            const fileFunctions = new Map<string, Set<string>>();
            const rawCalls: any[] = [];

            for (const data of rawAstData) {
                const fileId = data.fileId.replace(/\.json$/, '').replace(/\\/g, '/');
                this.traverseTree(
                    data.rootNode, fileId, fileId, uniqueNodes, uniqueEdges, fileImports, fileFunctions, rawCalls, validFileIds
                );
            }

            for (const call of rawCalls) {
                const { fromContext, fromFileId, calleeText } = call;
                let targetFuncId: string | null = null;

                const parts = calleeText.split('.');
                const baseName = parts[0];
                const methodName = parts.length > 1 ? parts[parts.length - 1] : baseName;

                const importsForFile = fileImports.get(fromFileId);

                if (importsForFile?.has(baseName)) {
                    const modulePath = importsForFile.get(baseName)!;
                    targetFuncId = `${modulePath}::${methodName}`;

                    if (!uniqueNodes.has(targetFuncId)) {
                        uniqueNodes.set(targetFuncId, { id: targetFuncId, label: 'Function', name: methodName });
                    }
                } else if (fileFunctions.get(fromFileId)?.has(methodName)) {
                    targetFuncId = `${fromFileId}::${methodName}`;
                }

                if (targetFuncId) {
                    const edgeKey = `${fromContext}-CALLS-${targetFuncId}`;
                    uniqueEdges.set(edgeKey, { from: fromContext, to: targetFuncId, type: 'CALLS' });
                }
            }

            const allNodes = Array.from(uniqueNodes.values());
            const allEdges = Array.from(uniqueEdges.values());

            await GraphRepo.batchWrite(allNodes, allEdges, repoId);

        } catch (err: any) {
            if (err instanceof ApiError) throw err;
            throw new ApiError(500, "Failed to process AST folder", [err.message]);
        }
    }

    private traverseTree(
        node: AstNode,
        fileId: string,
        parentContext: string,
        nodes: Map<string, any>,
        edges: Map<string, any>,
        fileImports: Map<string, Map<string, string>>,
        fileFunctions: Map<string, Set<string>>,
        rawCalls: any[],
        validFileIds: Set<string>,
        assignedName?: string
    ) {

        if (node.type === 'program' && parentContext === fileId) {
            nodes.set(fileId, { id: fileId, label: 'File', name: fileId });
            if (!fileImports.has(fileId)) fileImports.set(fileId, new Map());
            if (!fileFunctions.has(fileId)) fileFunctions.set(fileId, new Set());
        }

        let nextAssignedName = assignedName;

        if (['variable_declarator', 'assignment_expression', 'pair'].includes(node.type)) {
            const idNode = node.children?.find(c => ['identifier', 'property_identifier'].includes(c.type));
            if (idNode && idNode.text) nextAssignedName = idNode.text;
        }

        const isImport = ['import_statement', 'import_declaration'].includes(node.type);
        const isRequire = node.type === 'call_expression' && node.children?.[0]?.text === 'require';

        if (isImport || isRequire) {
            const stringNode = isRequire
                ? node.children?.find(c => c.type === 'arguments')?.children?.find(c => c.type === 'string')
                : node.children?.find(c => c.type === 'string');

            let modulePathText = stringNode?.text?.replace(/['"]/g, '');

            if (modulePathText) {
                let resolvedPath = modulePathText;

                if (resolvedPath.startsWith('.')) {
                    resolvedPath = path.posix.join(path.dirname(fileId), modulePathText).replace(/\\/g, '/');
                    if (!validFileIds.has(resolvedPath)) {
                        if (resolvedPath.endsWith('.js')) {
                            const tsPath = resolvedPath.replace(/\.js$/, '.ts');
                            const tsxPath = resolvedPath.replace(/\.js$/, '.tsx');

                            if (validFileIds.has(tsPath)) resolvedPath = tsPath;
                            else if (validFileIds.has(tsxPath)) resolvedPath = tsxPath;
                        } else if (!/\.[a-z]+$/.test(resolvedPath)) {
                            if (validFileIds.has(`${resolvedPath}.ts`)) resolvedPath += '.ts';
                            else if (validFileIds.has(`${resolvedPath}.tsx`)) resolvedPath += '.tsx';
                            else if (validFileIds.has(`${resolvedPath}.js`)) resolvedPath += '.js';
                            else if (validFileIds.has(`${resolvedPath}/index.ts`)) resolvedPath += '/index.ts';
                            else if (validFileIds.has(`${resolvedPath}/index.js`)) resolvedPath += '/index.js';
                        }
                    }
                }

                const extractIdentifiers = (n: AstNode) => {
                    if (n.type === 'identifier') {
                        fileImports.get(fileId)?.set(n.text!, resolvedPath);
                    }
                    n.children?.forEach(extractIdentifiers);
                };

                if (isImport) {
                    node.children?.filter(c => c.type !== 'string').forEach(extractIdentifiers);
                } else if (nextAssignedName) {
                    fileImports.get(fileId)?.set(nextAssignedName, resolvedPath);
                }

                nodes.set(resolvedPath, { id: resolvedPath, label: 'File', name: resolvedPath });
                edges.set(`${fileId}-IMPORTS-${resolvedPath}`, { from: fileId, to: resolvedPath, type: 'IMPORTS' });
            }
        }

        let currentContext = parentContext;
        const isFunction = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].includes(node.type);

        if (isFunction) {
            const idNode = node.children?.find(c => ['identifier', 'property_identifier'].includes(c.type));
            let funcName = idNode?.text || nextAssignedName;

            const isValidName = funcName &&
                funcName.toLowerCase() !== 'anonymous' &&
                funcName.toLowerCase() !== 'undefined' &&
                /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(funcName);

            if (isValidName) {
                const funcId = `${fileId}::${funcName}`;

                nodes.set(funcId, {
                    id: funcId,
                    label: 'Function',
                    name: funcName,
                    startLine: node.startRow,
                    endLine: node.endRow
                });

                edges.set(`${fileId}-DEFINES-${funcId}`, { from: fileId, to: funcId, type: 'DEFINES' });
                fileFunctions.get(fileId)?.add(funcName);
                currentContext = funcId;
            }

            nextAssignedName = undefined;
        }

        if (node.type === 'call_expression') {
            const callee = node.children?.find(c => ['member_expression', 'identifier'].includes(c.type));
            if (callee && callee.text && callee.text !== 'require') {
                rawCalls.push({
                    fromContext: currentContext,
                    fromFileId: fileId,
                    calleeText: callee.text
                });
            }
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                const shouldPassName = ['variable_declarator', 'assignment_expression', 'pair', 'parenthesized_expression', 'expression_statement'].includes(node.type);

                this.traverseTree(
                    child, fileId, currentContext, nodes, edges, fileImports, fileFunctions, rawCalls, validFileIds,
                    shouldPassName ? nextAssignedName : undefined
                );
            }
        }
    }
}