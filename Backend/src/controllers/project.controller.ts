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
    const repo = await Repository.findOne({ url: gitHubURL });
    let uniqueRepoId: string = repo ? repo.repoId : uuidv4();

    try {
        const repoName = gitHubURL.split('/').pop() || 'Unknown Repo';
        if (!repo) {
            await Repository.create({
                repoId: uniqueRepoId,
                url: gitHubURL,
                name: repoName
            });
        }
        const { mongoNodes, rawAstData } = await processRepositoryAST(folderId, tempdir, uniqueRepoId);
        if (mongoNodes && mongoNodes.length > 0) {
            await saveAstNodesToMongo(uniqueRepoId, mongoNodes);
        }

        const astService = new AstService();
        await astService.processAstData(rawAstData, uniqueRepoId);
        return res.status(200).json({
            message: "Successfully uploaded",
            success: true,
            repoId: uniqueRepoId
        });

    } finally {
        if (tempdir) {
            deleteTemp(tempdir, folderId);
        }
    }
});