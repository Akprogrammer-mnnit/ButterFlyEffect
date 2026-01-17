import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import * as fs from 'fs';
import * as path from 'path';

let inputDir = './temp';
let OUTPUT_DIR = './ast_results';

const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build'];

const parser = new Parser();
parser.setLanguage(JavaScript as any);

/**
 * Recursively get JS files (same behavior as first code, but with ignores)
 */
function getAllFiles(dirPath: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
        if (IGNORED_FOLDERS.includes(entry)) continue;

        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            getAllFiles(fullPath, files);
        } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Optimized semantic serialization (from second code)
 */
function serializeSemanticNode(
    node: Parser.SyntaxNode,
    sourceCode: string
): any {
    const children: any[] = [];

    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)!;
        if (child.isNamed) {
            children.push(serializeSemanticNode(child, sourceCode));
        }
    }

    return {
        type: node.type,
        text:
            node.type === 'string'
                ? node.text
                : sourceCode.substring(node.startIndex, node.endIndex),
        start: node.startPosition,
        end: node.endPosition,
        children
    };
}

/**
 * MAIN RUN FUNCTION (PATH LOGIC SAME AS FIRST CODE)
 */
function run(fullpath: string) {
    const FINAL_INPUT_DIR = path.join(inputDir, fullpath);
    const FINAL_OUTPUT_DIR = path.join(OUTPUT_DIR, fullpath);

    if (!fs.existsSync(FINAL_INPUT_DIR)) {
        console.warn(`❌ Input folder doesn't exist: ${FINAL_INPUT_DIR}`);
        return;
    }

    if (!fs.existsSync(FINAL_OUTPUT_DIR)) {
        fs.mkdirSync(FINAL_OUTPUT_DIR, { recursive: true });
    }

    const jsFiles = getAllFiles(FINAL_INPUT_DIR);
    console.log(jsFiles);

    if (jsFiles.length === 0) {
        console.warn(`⚠️ No JS files found in ${FINAL_INPUT_DIR}`);
        return;
    }

    console.log(`🚀 Found ${jsFiles.length} files. Starting semantic parse...`);

    jsFiles.forEach(fullPath => {
        try {
            const sourceCode = fs.readFileSync(fullPath, 'utf8');
            const tree = parser.parse(sourceCode);

            const semanticTree = serializeSemanticNode(
                tree.rootNode,
                sourceCode
            );

            const relativePath = path.relative(FINAL_INPUT_DIR, fullPath);
            const safeFileName =
                relativePath.replace(/[/\\]/g, '_') + '.json';

            const outputPath = path.join(FINAL_OUTPUT_DIR, safeFileName);

            const output = {
                file: relativePath,
                timestamp: new Date().toISOString(),
                root: semanticTree
            };

            fs.writeFileSync(
                outputPath,
                JSON.stringify(output, null, 2)
            );

            console.log(`✅ Processed: ${relativePath}`);
        } catch (err) {
            console.error(`❌ Error parsing ${fullPath}`, err);
        }
    });

    console.log('\n🎉 All files processed successfully.');
}

export default run;
