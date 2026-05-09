import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { cloneRepo, deleteTemp } from '../services/git.service.js'
import run from "../services/parse.service.js"
import { AstService } from '../services/ast.service.js';
import { parseAndSaveToMongo } from '../services/parseMongo.service.js';
import { v4 as uuidv4 } from 'uuid';
import Repository from '../models/Repository.js';
export const analyzeRepo = asyncHandler(async (req: Request, res: Response) => {
    const { gitHubURL } = req.body;

    if (!gitHubURL) {
        throw new ApiError(404, "Repo not found");
    }

    let tempdir = "";
    let folderId = "";

    const cloneResult = await cloneRepo(gitHubURL);
    if (!cloneResult) throw new ApiError(404, "could not clone the repo")

    tempdir = cloneResult.tempdir;
    folderId = cloneResult.folderid;
    const uniqueRepoId = uuidv4();
    console.log(`cloned successfully to: ${tempdir}`);

    try {
        const repoName = gitHubURL.split('/').pop() || 'Unknown Repo';
        await Repository.findOneAndUpdate(
            { url: gitHubURL },
            { name: repoName, repoId: uniqueRepoId, status: 'synced' },
            { upsert: true, new: true }
        );
        await run(folderId);
        await parseAndSaveToMongo(tempdir, uniqueRepoId);
        const astService = new AstService();
        await astService.processAstFolder(folderId, uniqueRepoId);

        console.log("Analysis Done.");

        return res.status(200).json({
            message: "Successfully uploaded",
            success: true,
            repoId: uniqueRepoId
        });

    } finally {
        if (tempdir) {
            deleteTemp(tempdir);
            console.log(`Cleaned up temporary directory: ${tempdir}`);
        }
    }
});