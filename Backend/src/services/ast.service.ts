import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GraphRepo } from '../../db/graph.repo.js';
import { ApiError } from '../utils/apiError.js';

// Added startRow and endRow to the interface so TypeScript understands them
interface AstNode {
    type: string;
    text?: string;
    startRow?: number;
    endRow?: number;
    children?: AstNode[];
}

export class AstService {

    async processAstFolder(folderName: string) {
        const searchPath = `./ast_results/${folderName}/**/*.json`;

        try {
            console.log(`[Service] Scanning: ${searchPath}`);
            const files = await glob(searchPath.replace(/\\/g, '/'));

            if (files.length === 0) {
                throw new ApiError(404, `No .json files found in ${searchPath}`);
            }

            const uniqueNodes = new Map<string, any>();
            const uniqueEdges = new Map<string, any>();

            const fileImports = new Map<string, Map<string, string>>();
            const fileFunctions = new Map<string, Set<string>>();
            const rawCalls: any[] = [];

            // --- PASS 1: Extract all Files, Imports, and VALID Named Functions ---
            for (const filePath of files) {
                const fileId = path.relative(`./ast_results/${folderName}`, filePath)
                    .replace(/\.json$/, '')
                    .replace(/\\/g, '/');

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const rootNode = JSON.parse(content);
                    this.traverseTree(
                        rootNode, fileId, fileId, uniqueNodes, uniqueEdges, fileImports, fileFunctions, rawCalls
                    );
                } catch (e) {
                    console.error(`[Service] JSON Parse Error: ${filePath}`);
                }
            }

            // --- PASS 2: Strictly Link Internal/Imported Dependencies ---
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
                }

                else if (fileFunctions.get(fromFileId)?.has(methodName)) {
                    targetFuncId = `${fromFileId}::${methodName}`;
                }


                if (targetFuncId) {
                    const edgeKey = `${fromContext}-CALLS-${targetFuncId}`;
                    uniqueEdges.set(edgeKey, { from: fromContext, to: targetFuncId, type: 'CALLS' });
                }
            }

            const allNodes = Array.from(uniqueNodes.values());
            const allEdges = Array.from(uniqueEdges.values());

            console.log(`[Service] Extracted ${allNodes.length} perfectly validated nodes and ${allEdges.length} dependencies.`);
            await GraphRepo.batchWrite(allNodes, allEdges);

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
        assignedName?: string
    ) {

        // --- 1. REGISTER FILE ---
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

        // --- 2. EXTRACT IMPORTS/REQUIRES ---
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
                    if (!/\.[a-z]+$/.test(resolvedPath)) resolvedPath += '.js';
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

        // --- 3. EXTRACT NAMED FUNCTIONS ONLY ---
        const isFunction = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].includes(node.type);

        if (isFunction) {
            const idNode = node.children?.find(c => ['identifier', 'property_identifier'].includes(c.type));
            let funcName = idNode?.text || nextAssignedName;

            // ABSOLUTE HARD BLOCK:
            // Must exist. Cannot be "anonymous". Must be a valid JavaScript variable name.
            const isValidName = funcName &&
                funcName.toLowerCase() !== 'anonymous' &&
                funcName.toLowerCase() !== 'undefined' &&
                /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(funcName);

            if (isValidName) {
                const funcId = `${fileId}::${funcName}`;

                // TODO: Store node.text (the actual code) in MongoDB or flat files using `funcId` as the key.

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

        // --- 4. QUEUE CALLS ---
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
                    child, fileId, currentContext, nodes, edges, fileImports, fileFunctions, rawCalls,
                    shouldPassName ? nextAssignedName : undefined
                );
            }
        }

    }
}