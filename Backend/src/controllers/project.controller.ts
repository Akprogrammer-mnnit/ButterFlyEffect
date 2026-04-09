import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/apiError.js'
import { cloneRepo, deleteTemp } from '../services/git.service.js'
import run from "../services/parse.service.js"
import { AstService } from '../services/ast.service.js';
import { parseAndSaveToMongo } from '../services/parseMongo.service.js';
import mongoose from 'mongoose';
export const analyzeRepo = asyncHandler(async (req: Request, res: Response) => {
    const { gitHubURL } = req.body;

    if (!gitHubURL) {
        throw new ApiError(404, "Repo not found");
    }

    let tempdir = ""
    let folderId = ""

    const cloneResult = await cloneRepo(gitHubURL);
    if (!cloneResult) throw new ApiError(404, "could not clone the repo")

    tempdir = cloneResult.tempdir;
    folderId = cloneResult.folderid;
    console.log(`cloned successfully to: ${tempdir}`);
    await run(folderId);
    const mockRepoId = new mongoose.Types.ObjectId().toString();
    await parseAndSaveToMongo(tempdir, mockRepoId);
    const astService = new AstService();
    await astService.processAstFolder(folderId);
    console.log("Done.");
    return res.status(200).json(
        { message: "successfully uploaded the folder" }
    )
});