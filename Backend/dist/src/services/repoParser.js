var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from 'fs/promises';
import path from 'path';
import { isBinary } from 'istextorbinary';
import RepoNode from '../models/RepoNode.js';
const IGNORED_FOLDERS = new Set(['node_modules', '.git', 'build', 'dist', '__pycache__', '.venv', 'env']);
function walkDirectory(currentDir_1, baseDir_1) {
    return __awaiter(this, arguments, void 0, function* (currentDir, baseDir, fileList = []) {
        const entries = yield fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            if (IGNORED_FOLDERS.has(entry.name))
                continue;
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            const parentPath = path.dirname(relativePath) === '.' ? '/' : path.dirname(relativePath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                fileList.push({
                    type: 'folder',
                    name: entry.name,
                    path: relativePath,
                    parentPath: parentPath
                });
                yield walkDirectory(fullPath, baseDir, fileList);
            }
            else {
                const stat = yield fs.stat(fullPath);
                if (stat.size > 1024 * 1024)
                    continue;
                const buffer = yield fs.readFile(fullPath);
                if (isBinary(entry.name, buffer))
                    continue;
                fileList.push({
                    type: 'file',
                    name: entry.name,
                    path: relativePath,
                    parentPath: parentPath,
                    size: stat.size,
                    content: buffer.toString('utf-8')
                });
            }
        }
        return fileList;
    });
}
export const processAndStoreRepo = (tempFolderPath, repoId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const nodes = yield walkDirectory(tempFolderPath, tempFolderPath);
        const dbNodes = nodes.map(node => (Object.assign(Object.assign({}, node), { repoId })));
        yield RepoNode.deleteMany({ repoId });
        const BATCH_SIZE = 1000;
        for (let i = 0; i < dbNodes.length; i += BATCH_SIZE) {
            const batch = dbNodes.slice(i, i + BATCH_SIZE);
            yield RepoNode.insertMany(batch);
        }
        return true;
    }
    catch (error) {
        console.error('Error parsing repo:', error);
        throw error;
    }
});
