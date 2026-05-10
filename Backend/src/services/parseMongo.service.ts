import fs from 'fs';
import path from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import AstNode from '../models/AstNode.js';

const parser = new Parser();

const LANG_MAP: Record<string, any> = {
    '.js': JavaScript,
    '.jsx': JavaScript,
    '.ts': JavaScript,
    '.py': Python,
};

const IGNORED_FOLDERS = ['node_modules', '.git', 'build', 'dist'];

function getAllFiles(dirPath: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        if (IGNORED_FOLDERS.includes(entry)) continue;
        const fullpath = path.join(dirPath, entry);
        if (fs.statSync(fullpath).isDirectory()) {
            getAllFiles(fullpath, files);
        } else {
            const ext = path.extname(entry).toLowerCase();
            if (LANG_MAP[ext]) files.push(fullpath);
        }
    }
    return files;
}

function extractNodesFromAST(rootNode: any, sourceCode: string, relativePath: string, repoId: string) {
    const extractedNodes: any[] = [];

    function walkAST(node: any) {
        if (node.type === 'function_declaration' || node.type === 'method_definition') {
            const nameNode = node.children.find((c: any) => c.type === 'identifier' || c.type === 'property_identifier');
            const funcName = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'anonymous';

            extractedNodes.push(buildNodeObject(funcName, node, relativePath, repoId, sourceCode));
        }

        else if (node.type === 'variable_declarator') {
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
        }

        else if (node.type === 'export_statement') {
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
        code: sourceCode || '// Empty file'
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


export const parseAndSaveToMongo = async (tempFolderPath: string, repoId: string) => {
    console.log(`\n--- 🕵️ PARSER: Extracting Functions ---`);
    if (!fs.existsSync(tempFolderPath)) return;

    const sourceFiles = getAllFiles(tempFolderPath);
    let allNodesToSave: any[] = [];

    for (const fullPath of sourceFiles) {
        const ext = path.extname(fullPath).toLowerCase();
        parser.setLanguage(LANG_MAP[ext]);

        const sourceCode = fs.readFileSync(fullPath, 'utf8');
        const tree = parser.parse(sourceCode);
        const relativePath = path.relative(tempFolderPath, fullPath).replace(/\\/g, '/');

        const fileNodes = extractNodesFromAST(tree.rootNode, sourceCode, relativePath, repoId);
        allNodesToSave = allNodesToSave.concat(fileNodes);
    }

    function extractNodesFromAST(rootNode: any, sourceCode: string, relativePath: string, repoId: string) {
        const extractedNodes: any[] = [];

        function walkAST(node: any) {
            if (node.type === 'function_declaration' || node.type === 'method_definition') {
                const nameNode = node.children.find((c: any) => c.type === 'identifier' || c.type === 'property_identifier');
                const funcName = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'anonymous';

                extractedNodes.push(buildNodeObject(funcName, node, relativePath, repoId, sourceCode));
            }

            else if (node.type === 'variable_declarator') {
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
            }

            else if (node.type === 'export_statement') {
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
            code: sourceCode || '// Empty file'
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
};