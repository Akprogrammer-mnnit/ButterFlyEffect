var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GraphRepo } from '../../db/graph.repo.js';
import { ApiError } from '../utils/apiError.js';
export class AstService {
    processAstFolder(folderName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const searchPath = `./ast_results/${folderName}/**/*.json`;
            try {
                console.log(`[Service] Scanning: ${searchPath}`);
                const files = yield glob(searchPath.replace(/\\/g, '/'));
                if (files.length === 0) {
                    throw new ApiError(404, `No .json files found in ${searchPath}`);
                }
                const uniqueNodes = new Map();
                const uniqueEdges = new Map();
                const fileImports = new Map();
                const fileFunctions = new Map();
                const rawCalls = [];
                // --- PASS 1: Extract all Files, Imports, and VALID Named Functions ---
                for (const filePath of files) {
                    const fileId = path.relative(`./ast_results/${folderName}`, filePath)
                        .replace(/\.json$/, '')
                        .replace(/\\/g, '/');
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const rootNode = JSON.parse(content);
                        this.traverseTree(rootNode, fileId, fileId, uniqueNodes, uniqueEdges, fileImports, fileFunctions, rawCalls);
                    }
                    catch (e) {
                        console.error(`[Service] JSON Parse Error: ${filePath}`);
                    }
                }
                // --- PASS 2: Strictly Link Internal/Imported Dependencies ---
                for (const call of rawCalls) {
                    const { fromContext, fromFileId, calleeText } = call;
                    let targetFuncId = null;
                    const parts = calleeText.split('.');
                    const baseName = parts[0];
                    const methodName = parts.length > 1 ? parts[parts.length - 1] : baseName;
                    const importsForFile = fileImports.get(fromFileId);
                    if (importsForFile === null || importsForFile === void 0 ? void 0 : importsForFile.has(baseName)) {
                        const modulePath = importsForFile.get(baseName);
                        targetFuncId = `${modulePath}::${methodName}`;
                        if (!uniqueNodes.has(targetFuncId)) {
                            uniqueNodes.set(targetFuncId, { id: targetFuncId, label: 'Function', name: methodName });
                        }
                    }
                    else if ((_a = fileFunctions.get(fromFileId)) === null || _a === void 0 ? void 0 : _a.has(methodName)) {
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
                yield GraphRepo.batchWrite(allNodes, allEdges);
            }
            catch (err) {
                if (err instanceof ApiError)
                    throw err;
                throw new ApiError(500, "Failed to process AST folder", [err.message]);
            }
        });
    }
    traverseTree(node, fileId, parentContext, nodes, edges, fileImports, fileFunctions, rawCalls, assignedName) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        // --- 1. REGISTER FILE ---
        if (node.type === 'program' && parentContext === fileId) {
            nodes.set(fileId, { id: fileId, label: 'File', name: fileId });
            if (!fileImports.has(fileId))
                fileImports.set(fileId, new Map());
            if (!fileFunctions.has(fileId))
                fileFunctions.set(fileId, new Set());
        }
        let nextAssignedName = assignedName;
        if (['variable_declarator', 'assignment_expression', 'pair'].includes(node.type)) {
            const idNode = (_a = node.children) === null || _a === void 0 ? void 0 : _a.find(c => ['identifier', 'property_identifier'].includes(c.type));
            if (idNode && idNode.text)
                nextAssignedName = idNode.text;
        }
        // --- 2. EXTRACT IMPORTS/REQUIRES ---
        const isImport = ['import_statement', 'import_declaration'].includes(node.type);
        const isRequire = node.type === 'call_expression' && ((_c = (_b = node.children) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) === 'require';
        if (isImport || isRequire) {
            const stringNode = isRequire
                ? (_f = (_e = (_d = node.children) === null || _d === void 0 ? void 0 : _d.find(c => c.type === 'arguments')) === null || _e === void 0 ? void 0 : _e.children) === null || _f === void 0 ? void 0 : _f.find(c => c.type === 'string')
                : (_g = node.children) === null || _g === void 0 ? void 0 : _g.find(c => c.type === 'string');
            let modulePathText = (_h = stringNode === null || stringNode === void 0 ? void 0 : stringNode.text) === null || _h === void 0 ? void 0 : _h.replace(/['"]/g, '');
            if (modulePathText) {
                let resolvedPath = modulePathText;
                if (resolvedPath.startsWith('.')) {
                    resolvedPath = path.posix.join(path.dirname(fileId), modulePathText).replace(/\\/g, '/');
                    if (!/\.[a-z]+$/.test(resolvedPath))
                        resolvedPath += '.js';
                }
                const extractIdentifiers = (n) => {
                    var _a, _b;
                    if (n.type === 'identifier') {
                        (_a = fileImports.get(fileId)) === null || _a === void 0 ? void 0 : _a.set(n.text, resolvedPath);
                    }
                    (_b = n.children) === null || _b === void 0 ? void 0 : _b.forEach(extractIdentifiers);
                };
                if (isImport) {
                    (_j = node.children) === null || _j === void 0 ? void 0 : _j.filter(c => c.type !== 'string').forEach(extractIdentifiers);
                }
                else if (nextAssignedName) {
                    (_k = fileImports.get(fileId)) === null || _k === void 0 ? void 0 : _k.set(nextAssignedName, resolvedPath);
                }
                nodes.set(resolvedPath, { id: resolvedPath, label: 'File', name: resolvedPath });
                edges.set(`${fileId}-IMPORTS-${resolvedPath}`, { from: fileId, to: resolvedPath, type: 'IMPORTS' });
            }
        }
        let currentContext = parentContext;
        // --- 3. EXTRACT NAMED FUNCTIONS ONLY ---
        const isFunction = ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].includes(node.type);
        if (isFunction) {
            const idNode = (_l = node.children) === null || _l === void 0 ? void 0 : _l.find(c => ['identifier', 'property_identifier'].includes(c.type));
            let funcName = (idNode === null || idNode === void 0 ? void 0 : idNode.text) || nextAssignedName;
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
                (_m = fileFunctions.get(fileId)) === null || _m === void 0 ? void 0 : _m.add(funcName);
                currentContext = funcId;
            }
            nextAssignedName = undefined;
        }
        // --- 4. QUEUE CALLS ---
        if (node.type === 'call_expression') {
            const callee = (_o = node.children) === null || _o === void 0 ? void 0 : _o.find(c => ['member_expression', 'identifier'].includes(c.type));
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
                this.traverseTree(child, fileId, currentContext, nodes, edges, fileImports, fileFunctions, rawCalls, shouldPassName ? nextAssignedName : undefined);
            }
        }
    }
}
