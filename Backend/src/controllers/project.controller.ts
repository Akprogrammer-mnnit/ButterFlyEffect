import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js'; 
import { v4 as uuidv4 } from 'uuid';
import Repository from '../models/Repository.js';
import { repoQueue } from '../services/bullmq.service.js';

export const analyzeRepo = asyncHandler(async (req: Request, res: Response) => {
    const { gitHubURL } = req.body;

    if (!gitHubURL) {
        throw new ApiError(400, "GitHub URL is required");
    }

    const repo = await Repository.findOne({ url: gitHubURL });
    let uniqueRepoId: string = repo ? repo.repoId : uuidv4();

    if (!repo) {
        const repoName = gitHubURL.split('/').pop() || 'Unknown Repo';
        await Repository.create({
            repoId: uniqueRepoId,
            url: gitHubURL,
            name: repoName
        });
    }

    await repoQueue.add('parse-ast-job', {
        gitHubURL,
        uniqueRepoId
    });

    return res.status(202).json(
        new ApiResponse(
            202, 
            { repoId: uniqueRepoId }, 
            "Repository queued for processing successfully."
        )
    );
});