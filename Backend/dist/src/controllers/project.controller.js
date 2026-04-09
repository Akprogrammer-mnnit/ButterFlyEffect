var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { cloneRepo } from '../services/git.service.js';
import run from "../services/parse.service.js";
import { AstService } from '../services/ast.service.js';
import { parseAndSaveToMongo } from '../services/parseMongo.service.js';
import mongoose from 'mongoose';
export const analyzeRepo = asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { gitHubURL } = req.body;
    if (!gitHubURL) {
        throw new ApiError(404, "Repo not found");
    }
    let tempdir = "";
    let folderId = "";
    const cloneResult = yield cloneRepo(gitHubURL);
    if (!cloneResult)
        throw new ApiError(404, "could not clone the repo");
    tempdir = cloneResult.tempdir;
    folderId = cloneResult.folderid;
    console.log(`cloned successfully to: ${tempdir}`);
    yield run(folderId);
    const mockRepoId = new mongoose.Types.ObjectId().toString();
    yield parseAndSaveToMongo(tempdir, mockRepoId);
    const astService = new AstService();
    yield astService.processAstFolder(folderId);
    console.log("Done.");
    return res.status(200).json({ message: "successfully uploaded the folder" });
}));
