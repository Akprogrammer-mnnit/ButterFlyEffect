import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { cloneRepo, deleteTemp } from './git.service.js';
import { processRepositoryAST } from './parse.service.js';
import { AstService } from './ast.service.js';
import { saveAstNodesToMongo } from './astMongo.service.js';
import { ApiError } from '../utils/apiError.js';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new (IORedis as any)(redisUrl, {
    maxRetriesPerRequest: null 
});

export const repoQueue = new Queue('repo-processing-queue', { 
    connection: connection as any 
});

const worker = new Worker('repo-processing-queue', async (job: Job) => {
    const { gitHubURL, uniqueRepoId } = job.data;
    console.log(`Background Job Started: Cloning and parsing ${gitHubURL}`);
    
    const cloneResult = await cloneRepo(gitHubURL);
    if (!cloneResult) {
        throw new ApiError(500, "Could not clone the repository from GitHub.");
    }

    const { tempdir, folderid: folderId } = cloneResult;

    try {
        const { mongoNodes, rawAstData } = await processRepositoryAST(folderId, tempdir, uniqueRepoId);
        
        if (mongoNodes && mongoNodes.length > 0) {
            await saveAstNodesToMongo(uniqueRepoId, mongoNodes);
        }

        const astService = new AstService();
        await astService.processAstData(rawAstData, uniqueRepoId);

        console.log(` Background Job Completed: ${gitHubURL} is now in Neo4j.`);
    } catch (error: any) {
        console.error(` Background Job Failed for ${gitHubURL}:`, error.message);
        if (!(error instanceof ApiError)) {
            throw new ApiError(500, "Failed during AST parsing or database writing", [error.message]);
        }
        throw error;
    } finally {
        if (tempdir) {
            deleteTemp(tempdir, folderId);
        }
    }
}, { connection: connection as any });

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
});