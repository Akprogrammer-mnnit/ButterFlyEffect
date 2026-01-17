import {Request,Response} from 'express';
import {asyncHandler} from '../utils/asyncHandler'
import {ApiError} from '../utils/apiError'
import {ApiResponse} from '../utils/apiResponse'
import {cloneRepo,deleteTemp} from '../services/git.service'
import run from "../services/parse.service"
export const analyzeRepo = asyncHandler(async(req:Request,res:Response)=>{
    const {gitHubURL} = req.body;

    if(!gitHubURL){
        throw new ApiError(404,"Repo not found");
    }

    let tempdir=""
    let folderId=""

    const cloneResult = await cloneRepo(gitHubURL);
    if(!cloneResult) throw new ApiError(404,"could not clone the repo")
    tempdir = cloneResult.tempdir;
    folderId = cloneResult.folderid;
    console.log(`cloned successfully to: ${tempdir}`);
    run(`${folderId}`);
    return res.status(200).json(
        {message:"successfully uploaded the folder"}
    )
});