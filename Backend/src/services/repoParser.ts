import fs from 'fs/promises';
import path from 'path';
import { isBinary } from 'istextorbinary';
import mongoose from 'mongoose';
import RepoNode from '../models/RepoNode.js';

const IGNORED_FOLDERS = new Set(['node_modules', '.git', 'build', 'dist', '__pycache__', '.venv', 'env']);

interface NodeData {
  type: 'file' | 'folder';
  name: string;
  path: string;
  parentPath: string;
  size?: number;
  content?: string | null;
}

async function walkDirectory(currentDir: string, baseDir: string, fileList: NodeData[] = []): Promise<NodeData[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_FOLDERS.has(entry.name)) continue;

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
      await walkDirectory(fullPath, baseDir, fileList);
    } else {
      const stat = await fs.stat(fullPath);

      if (stat.size > 1024 * 1024) continue;

      const buffer = await fs.readFile(fullPath);
      if (isBinary(entry.name, buffer)) continue;

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
}

export const processAndStoreRepo = async (tempFolderPath: string, repoId: mongoose.Types.ObjectId | string): Promise<boolean> => {
  try {
    const nodes = await walkDirectory(tempFolderPath, tempFolderPath);

    const dbNodes = nodes.map(node => ({ ...node, repoId }));

    await RepoNode.deleteMany({ repoId });

    const BATCH_SIZE = 1000;
    for (let i = 0; i < dbNodes.length; i += BATCH_SIZE) {
      const batch = dbNodes.slice(i, i + BATCH_SIZE);
      await RepoNode.insertMany(batch);
    }

    return true;
  } catch (error) {
    console.error('Error parsing repo:', error);
    throw error;
  }
};