import fs from 'fs';
import path from 'path';
import { parser, LANG_MAP, getAllFiles } from '../utils/parser.utils.js';
import AstNode from '../models/AstNode.js';
import { promises as fsPromises } from 'fs';

function extractNodesFromAST(rootNode: any, sourceCode: string, relativePath: string, repoId: string) {
    const extractedNodes: any[] = [];

    function walkAST(node: any) {
        if (node.type === 'function_declaration' || node.type === 'method_definition') {
            const nameNode = node.children.find((c: any) => c.type === 'identifier' || c.type === 'property_identifier');
            const funcName = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'anonymous';
            extractedNodes.push(buildNodeObject(funcName, node, relativePath, repoId, sourceCode));
        } else if (node.type === 'variable_declarator') {
            const nameNode = node.children.find((c: any) => c.type === 'identifier');
            const funcName = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : null;

            if (funcName) {
                let targetFuncNode = node.children.find((c: any) => c.type === 'arrow_function' || c.type === 'function_expression');

                if (!targetFuncNode) {
                    const callExpr = node.children.find((c: any) => c.type === 'call_expression');
                    if (callExpr) {
                        const args = callExpr.children.find((c: any) => c.type === 'arguments');
                        if (args) {
                            targetFuncNode = args.children.find((c: any) => c.type === 'arrow_function' || c.type === 'function_expression');
                        }
                    }
                }

                if (targetFuncNode) {
                    extractedNodes.push(buildNodeObject(funcName, targetFuncNode, relativePath, repoId, sourceCode));
                }
            }
        } else if (node.type === 'export_statement') {
            const callExpr = node.children.find((c: any) => c.type === 'call_expression');
            if (callExpr) {
                const args = callExpr.children.find((c: any) => c.type === 'arguments');
                if (args) {
                    const targetFuncNode = args.children.find((c: any) => c.type === 'arrow_function' || c.type === 'function_expression');
                    if (targetFuncNode) {
                        extractedNodes.push(buildNodeObject('defaultExport', targetFuncNode, relativePath, repoId, sourceCode));
                    }
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            walkAST(node.child(i));
        }
    }

    walkAST(rootNode);

    extractedNodes.push({
        id: relativePath,
        repoId: repoId,
        name: relativePath.split('/').pop(),
        type: "File",
        file_path: relativePath,
        start_line: 1,
        end_line: sourceCode.split('\n').length || 1,
        code: sourceCode || ''
    });

    return extractedNodes;
}

function buildNodeObject(funcName: string, astNode: any, relativePath: string, repoId: string, sourceCode: string) {
    return {
        id: `${relativePath}::${funcName}`,
        repoId: repoId,
        name: funcName,
        type: "Function",
        file_path: relativePath,
        start_line: astNode.startPosition.row + 1,
        end_line: astNode.endPosition.row + 1,
        code: sourceCode.substring(astNode.startIndex, astNode.endIndex)
    };
}

function serializeSemanticNode(node: any, sourceCode: string) {
    const children: any[] = [];
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.isNamed) {
            children.push(serializeSemanticNode(child, sourceCode));
        }
    }

    const shouldCaptureText = [
        'identifier', 'string', 'property_identifier', 'type_identifier',
        'field_identifier', 'function_declarator',
        'function_declaration', 'arrow_function'
    ].includes(node.type);

    return {
        type: node.type,
        startRow: node.startPosition.row,
        endRow: node.endPosition.row,
        text: shouldCaptureText
            ? sourceCode.substring(node.startIndex, node.endIndex)
            : undefined,
        children
    };
}
export const processRepositoryAST = async (folderId: string, tempdir: string, repoId: string) => {
    if (!fs.existsSync(tempdir)) return { mongoNodes: [], rawAstData: [] };

    const sourceFiles = getAllFiles(tempdir);
    if (sourceFiles.length === 0) return { mongoNodes: [], rawAstData: [] };

    let allNodesToSave: any[] = [];
    let allRawAstData: any[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
        const batch = sourceFiles.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(batch.map(async (fullPath) => {
            try {
                const ext = path.extname(fullPath).toLowerCase();
                const selectedLang = LANG_MAP[ext];
                if (!selectedLang) return null;
                const sourceCode = await fsPromises.readFile(fullPath, 'utf8');
                parser.setLanguage(selectedLang);

                const tree = parser.parse(sourceCode);
                const relativePath = path.relative(tempdir, fullPath).replace(/\\/g, '/');
                const semanticTree = serializeSemanticNode(tree.rootNode, sourceCode);
                const fileNodes = extractNodesFromAST(tree.rootNode, sourceCode, relativePath, repoId);
                return { fileNodes, semanticData: { fileId: relativePath, rootNode: semanticTree } };
            } catch (error) {
                return null;
            }
        }));

        batchResults.forEach(result => {
            if (result) {
                allNodesToSave = allNodesToSave.concat(result.fileNodes);
                allRawAstData.push(result.semanticData);
            }
        });
    }
    return { mongoNodes: allNodesToSave, rawAstData: allRawAstData };
};