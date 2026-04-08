import fs from 'fs';
import path from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import AstNode from '../models/AstNode';

const parser = new Parser();

// Configure languages
const LANG_MAP: Record<string, any> = {
    '.js': JavaScript,
    '.jsx': JavaScript,
    '.ts': JavaScript,
    '.py': Python,
};

const IGNORED_FOLDERS = ['node_modules', '.git', 'build', 'dist'];

// Helper to find all files
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

// NEW: Recursive AST Traversal to extract individual functions
function extractNodesFromAST(rootNode: any, sourceCode: string, relativePath: string, repoId: string) {
    const extractedNodes: any[] = [];

    function walkAST(node: any) {
        // 1. Look for standard functions (e.g., function set(key, value) { ... })
        if (node.type === 'function_declaration' || node.type === 'method_definition') {
            // Find the name of the function
            const nameNode = node.children.find((c: any) => c.type === 'identifier' || c.type === 'property_identifier');
            const funcName = nameNode ? sourceCode.substring(nameNode.startIndex, nameNode.endIndex) : 'anonymous';

            extractedNodes.push({
                id: `${relativePath}::${funcName}`, // Matches Neo4j ID! e.g., 'backend/db.js::set'
                repoId: repoId,
                name: funcName,
                type: "Function",
                file_path: relativePath,
                start_line: node.startPosition.row + 1,
                end_line: node.endPosition.row + 1,
                code: sourceCode.substring(node.startIndex, node.endIndex) // Extracts ONLY the function code
            });
        }
        // 2. Look for arrow functions (e.g., const set = (key, value) => { ... })
        else if (node.type === 'variable_declarator') {
            const nameNode = node.children.find((c: any) => c.type === 'identifier');
            const arrowFuncNode = node.children.find((c: any) => c.type === 'arrow_function');
            
            if (nameNode && arrowFuncNode) {
                const funcName = sourceCode.substring(nameNode.startIndex, nameNode.endIndex);
                extractedNodes.push({
                    id: `${relativePath}::${funcName}`,
                    repoId: repoId,
                    name: funcName,
                    type: "Function",
                    file_path: relativePath,
                    start_line: arrowFuncNode.startPosition.row + 1,
                    end_line: arrowFuncNode.endPosition.row + 1,
                    code: sourceCode.substring(arrowFuncNode.startIndex, arrowFuncNode.endIndex)
                });
            }
        }

        // Recurse through all children
        for (let i = 0; i < node.childCount; i++) {
            walkAST(node.child(i));
        }
    }

    // Start the recursive walk
    walkAST(rootNode);

    // 3. ALSO save the entire file itself so Neo4j can reference "backend/server.js" as a 'File' type
    extractedNodes.push({
        id: relativePath, // Standard file ID
        repoId: repoId,
        name: path.basename(relativePath),
        type: "File",
        file_path: relativePath,
        start_line: 1,
        end_line: sourceCode.split('\n').length,
        code: sourceCode
    });

    return extractedNodes;
}


// Main Function
export const parseAndSaveToMongo = async (tempFolderPath: string, repoId: string) => {
    console.log(`\n--- 🕵️ PARSER: Extracting Functions ---`);
    if (!fs.existsSync(tempFolderPath)) return;

    const sourceFiles = getAllFiles(tempFolderPath);
    let allNodesToSave: any[] = [];

    // Parse files and extract functions
    for (const fullPath of sourceFiles) {
        const ext = path.extname(fullPath).toLowerCase();
        parser.setLanguage(LANG_MAP[ext]);

        const sourceCode = fs.readFileSync(fullPath, 'utf8');
        const tree = parser.parse(sourceCode);
        const relativePath = path.relative(tempFolderPath, fullPath).replace(/\\/g, '/');

        // Extract functions and the file itself
        const fileNodes = extractNodesFromAST(tree.rootNode, sourceCode, relativePath, repoId);
        allNodesToSave = allNodesToSave.concat(fileNodes);
    }

    console.log(`Extracted ${allNodesToSave.length} total nodes (Files + Functions).`);

    // Save to MongoDB
    try {
        await AstNode.deleteMany({ repoId }); // Clear old data
        const saved = await AstNode.insertMany(allNodesToSave);
        console.log(`SUCCESS: Saved ${saved.length} nodes to MongoDB!`);
    } catch (error) {
        console.error("MONGODB SAVE ERROR:", error);
    }
};