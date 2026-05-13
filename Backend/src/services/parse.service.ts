import fs from 'fs';
import path from 'path';
import { parser, LANG_MAP, getAllFiles } from '../utils/parser.utils.js';
import AstNode from '../models/AstNode.js';

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
    const FINAL_OUTPUT_DIR = path.join(process.cwd(), 'ast_results', folderId);

    if (!fs.existsSync(tempdir)) return [];

    const sourceFiles = getAllFiles(tempdir);
    if (sourceFiles.length === 0) return [];

    let allNodesToSave: any[] = [];

    for (const fullPath of sourceFiles) {
        try {
            const ext = path.extname(fullPath).toLowerCase();
            const selectedLang = LANG_MAP[ext];
            if (!selectedLang) continue;

            const sourceCode = fs.readFileSync(fullPath, 'utf8');
            parser.setLanguage(selectedLang);

            const tree = parser.parse(sourceCode);
            const relativePath = path.relative(tempdir, fullPath).replace(/\\/g, '/');

            const semanticTree = serializeSemanticNode(tree.rootNode, sourceCode);
            const outputPath = path.join(FINAL_OUTPUT_DIR, relativePath + '.json');
            const outputDir = path.dirname(outputPath);

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, JSON.stringify(semanticTree, null, 2));

            const fileNodes = extractNodesFromAST(tree.rootNode, sourceCode, relativePath, repoId);
            allNodesToSave = allNodesToSave.concat(fileNodes);

        } catch (error) { }
    }

    return allNodesToSave;
};