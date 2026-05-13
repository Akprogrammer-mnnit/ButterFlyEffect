import fs from 'fs';
import path from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Cpp from 'tree-sitter-cpp';
import C from 'tree-sitter-c';

export const IGNORED_FOLDERS = ['node_modules', '.git', 'build', 'dist', '__pycache__', '.venv', 'env'];

export const LANG_MAP: Record<string, any> = {
    '.js': JavaScript,
    '.jsx': JavaScript,
    '.ts': JavaScript,
    '.py': Python,
    '.cpp': Cpp,
    '.c': C,
    '.h': C,
    '.cxx': Cpp
};

export const parser = new Parser();

export function getAllFiles(dirPath: string, files: string[] = []): string[] {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(dirPath);
    } catch (e) {
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
                if (LANG_MAP[ext]) files.push(fullpath);
            }
        } catch (e) { }
    }
    return files;
}