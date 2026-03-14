import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Cpp from 'tree-sitter-cpp';
import C from 'tree-sitter-c';
import * as fs from 'fs';
import * as path from 'path';

const IGNORED_FOLDERS = ['node_modules', '.git', 'build', '__pycache__', '.venv', 'env'];

const LANG_MAP: Record<string, any> = {
    '.js': JavaScript,
    '.jsx': JavaScript,
    '.ts': JavaScript, 
    '.py': Python,
    '.cpp': Cpp,
    '.c': C,
    '.h': C,
    '.cxx': Cpp
};

const parser = new Parser();

function getAllFiles(dirPath: string, files: string[] = []): string[] {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(dirPath);
    } catch (e) {
        console.log(`Access denied: ${e}`);
        return files;
    }

    for (const entry of entries) {
        if (IGNORED_FOLDERS.includes(entry)) continue;
        const fullpath = path.join(dirPath, entry);
        try {
            const stat = fs.statSync(fullpath);
            if (stat.isDirectory()) {
                getAllFiles(fullpath, files);
            } else {
                const ext = path.extname(entry).toLowerCase();
                if (LANG_MAP[ext]) {
                    files.push(fullpath);
                }
            }
        } catch (e) {}
    }
    return files;
}

function serializeSemanticNode(node: any, sourceCode: string): any {
    const children: any[] = [];
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.isNamed) {
            children.push(serializeSemanticNode(child, sourceCode));
        }
    }

    const shouldCaptureText = [
        'identifier', 'string', 'property_identifier', 'type_identifier', 
        'field_identifier', 'member_expression', 'string_fragment'
    ].includes(node.type);

    return {
        type: node.type,
        text: shouldCaptureText ? sourceCode.substring(node.startIndex, node.endIndex) : undefined,
        children
    };
}

async function run(folderId: string) {
    const FINAL_INPUT_DIR = path.join(process.cwd(), 'temp', folderId);
    const FINAL_OUTPUT_DIR = path.join(process.cwd(), 'ast_results', folderId);

    if (!fs.existsSync(FINAL_INPUT_DIR)) {
        console.log(`Input folder doesn't exist : ${FINAL_INPUT_DIR}`);
        return;
    }

    const sourceFiles = getAllFiles(FINAL_INPUT_DIR);
    console.log(`[Parser] found ${sourceFiles.length} supported files in ${folderId}`);

    if (sourceFiles.length === 0) return;

    for (const fullPath of sourceFiles) {
        try {
            const ext = path.extname(fullPath).toLowerCase();
            const selectedLang = LANG_MAP[ext];
            if (!selectedLang) continue;
            
            parser.setLanguage(selectedLang);
            const sourceCode = fs.readFileSync(fullPath, 'utf8');
            const tree = parser.parse(sourceCode);
            const semanticTree = serializeSemanticNode(tree.rootNode, sourceCode);

            const relativePath = path.relative(FINAL_INPUT_DIR, fullPath).replace(/\\/g, '/');
            const outputPath = path.join(FINAL_OUTPUT_DIR, relativePath + '.json');
            
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, JSON.stringify(semanticTree, null, 2));
            console.log(`Parsed successfully: ${relativePath}`);
        } catch (error) {
            console.log(`Error parsing ${fullPath}: ${error}`);
        }
    }
}

export default run;