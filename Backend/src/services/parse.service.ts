import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import * as fs from 'fs';
import * as path from 'path'; 

let inputDir = './temp';
let OUTPUT_DIR = './ast_results'; 
const parser = new Parser();
parser.setLanguage(JavaScript as any);

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const absolutePath = path.join(dirPath, file);
        if (fs.statSync(absolutePath).isDirectory()) {
            getAllFiles(absolutePath, arrayOfFiles);
        } else if (file.endsWith('.js')) {
            arrayOfFiles.push(absolutePath);
        }
    });

    return arrayOfFiles;
}

function run(fullpath: string) { 
    
    inputDir = `${inputDir}/${fullpath}`
    if(!fs.existsSync(inputDir)) {
        console.warn(`Input folder doesn't exist: ${inputDir}`);
        return;
    }
    OUTPUT_DIR = `${OUTPUT_DIR}/${fullpath}`
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const jsFiles = getAllFiles(inputDir);
    console.log(jsFiles);
    
    if (jsFiles.length === 0) {
        console.warn(`No .js files found in ${inputDir}`);
        return;
    }

    console.log(`Found ${jsFiles.length} files. Starting parse...`);

    jsFiles.forEach((fullPath) => {
        try {
            const sourceCode = fs.readFileSync(fullPath, 'utf8');
            const tree = parser.parse(sourceCode);
            const astString = tree.rootNode.toString();

            const relativePath = path.relative(inputDir, fullPath);
            
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