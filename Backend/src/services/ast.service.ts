import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GraphRepo } from '../../db/graph.repo';
import { ApiError } from '../utils/apiError'; 

interface AstNode {
    type: string;
    text?: string;
    children?: AstNode[];
}

export class AstService {

    async processAstFolder(folderName: string) {
        const searchPath = `./ast_results/${folderName}/**/*.json`;

        try {
            console.log(`[Service] Scanning: ${searchPath}`);
            const files = await glob(searchPath);

            if (files.length === 0) {
                throw new ApiError(404, `No .json files found in ${searchPath}`);
            }

            console.log(`[Service] Found ${files.length} files. Parsing...`);

            const allNodes: any[] = [];
            const allEdges: any[] = [];

            for (const filePath of files) {
                const fileId = path.relative(`./ast_results/${folderName}`, filePath)
                                   .replace(/\.json$/, '')
                                   .replace(/\\/g, '/');

                                   
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const rootNode = JSON.parse(content);
                    this.traverseTree(rootNode, fileId, fileId, allNodes, allEdges);
                } catch (e) {
                    console.error(` [Service] JSON Parse Error: ${filePath}`);
                    continue; 
                }
            }

            await GraphRepo.batchWrite(allNodes, allEdges);

        } catch (err: any) {
            if (err instanceof ApiError) throw err;
            throw new ApiError(500, "Failed to process AST folder", [err.message]);
        }
    }

    private traverseTree(node: AstNode, fileId: string, parentContext: string, nodes: any[], edges: any[]) {
        
        if (node.type === 'program' && parentContext === fileId) {
            nodes.push({ id: fileId, label: 'File', name: fileId });
        }

        if (node.type === 'function_declaration' || node.type === 'arrow_function') {
            const idNode = node.children?.find(c => c.type === 'identifier');
            const funcName = idNode?.text || 'anonymous';
            const funcId = `${fileId}::${funcName}`;

            nodes.push({ id: funcId, label: 'Function', name: funcName });
            edges.push({ from: fileId, to: funcId, type: 'DEFINES' });

            parentContext = funcId; 
        }

        if (node.type === 'call_expression') {
            const callee = node.children?.find(c => 
                c.type === 'member_expression' || c.type === 'identifier'
            );

            if (callee && callee.text) {
                const targetName = callee.text; 
                const targetId = `Service::${targetName}`; 

                nodes.push({ id: targetId, label: 'Service', name: targetName });
                edges.push({ from: parentContext, to: targetId, type: 'CALLS' });
            }
        }

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                this.traverseTree(child, fileId, parentContext, nodes, edges);
            }
        }
    }
}