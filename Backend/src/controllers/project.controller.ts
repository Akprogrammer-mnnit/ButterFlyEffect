import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { cloneRepo, deleteTemp } from '../services/git.service.js';
import { processRepositoryAST } from '../services/parse.service.js';
import { AstService } from '../services/ast.service.js';
import { saveAstNodesToMongo } from '../services/astMongo.service.js';
import { v4 as uuidv4 } from 'uuid';
import Repository from '../models/Repository.js';

export const analyzeRepo = asyncHandler(async (req: Request, res: Response) => {
    const { gitHubURL } = req.body;

    if (!gitHubURL) {
        throw new ApiError(404, "Repo not found");
    }

    const cloneResult = await cloneRepo(gitHubURL);
    if (!cloneResult) throw new ApiError(404, "could not clone the repo");

    const { tempdir, folderid: folderId } = cloneResult;
    const uniqueRepoId = uuidv4();

    try {
        const repoName = gitHubURL.split('/').pop() || 'Unknown Repo';
        await Repository.findOneAndUpdate(
            { url: gitHubURL },
            { name: repoName, repoId: uniqueRepoId, status: 'synced' },
            { upsert: true, new: true }
        );
        const mongoNodesToSave = await processRepositoryAST(folderId, tempdir, uniqueRepoId);
        if (mongoNodesToSave && mongoNodesToSave.length > 0) {
            await saveAstNodesToMongo(uniqueRepoId, mongoNodesToSave);
        }
        const astService = new AstService();
        await astService.processAstFolder(folderId, uniqueRepoId);

        return res.status(200).json({
            message: "Successfully uploaded",
            success: true,
            repoId: uniqueRepoId
        });

    } finally {
        if (tempdir) {
            deleteTemp(tempdir);
        }
    }
});