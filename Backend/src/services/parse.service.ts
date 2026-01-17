import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const INPUT_DIR = './temp';  // Change this to your source folder
const OUTPUT_DIR = './ast_results'; // Where the AST files will be saved

// 1. Initialize Parser
const parser = new Parser();
parser.setLanguage(JavaScript as any);

/**
 * Recursively finds all JS files in a directory
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const absolutePath = path.join(dirPath, file);
        if (fs.statSync(absolutePath).isDirectory()) {
            getAllFiles(absolutePath, arrayOfFiles);
        } else if (file.endsWith('.ts')) {
            arrayOfFiles.push(absolutePath);
        }
    });

    return arrayOfFiles;
}

/**
 * Main execution function
 */
function run() {
    // Ensure output directory exists
    if(!fs.existsSync(INPUT_DIR)) {
        console.warn(`Input folder doesn't exist`);
        return;
    }
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const jsFiles = getAllFiles(INPUT_DIR);

    if (jsFiles.length === 0) {
        console.warn(`No .js files found in ${INPUT_DIR}`);
        return;
    }

    console.log(`Found ${jsFiles.length} files. Starting parse...`);

    jsFiles.forEach((fullPath) => {
        try {
            // Read source
            const sourceCode = fs.readFileSync(fullPath, 'utf8');

            // Parse
            const tree = parser.parse(sourceCode);

            // Convert to S-expression string (you can also use JSON.stringify for nodes)
            const astString = tree.rootNode.toString();

            // Prepare output filename
            // Example: my_js_files/utils/math.js -> ast_results/utils_math.txt
            const relativePath = path.relative(INPUT_DIR, fullPath);
            const safeFileName = relativePath.replace(/[/\\]/g, '_') + '.ast';
            const outputPath = path.join(OUTPUT_DIR, safeFileName);

            fs.writeFileSync(outputPath, astString);
            console.log(`✅ Processed: ${relativePath}`);
        } catch (error) {
            console.error(`❌ Error parsing ${fullPath}:`, error);
        }
    });

    console.log('\nAll files processed successfully.');
}

export default run;