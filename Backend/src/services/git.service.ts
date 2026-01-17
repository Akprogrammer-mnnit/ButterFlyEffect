import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import {v4 as uuidd} from 'uuid';

const git = simpleGit();

export const cloneRepo = async(repourl:string)=>{
    const folderid = uuidd();
    const tempdir = path.join(process.cwd(),'temp',folderid);

    if(!fs.existsSync(path.join(process.cwd(),'temp'))){
        fs.mkdirSync(path.join(process.cwd(),'temp'));
    }

    try{
        await git.clone(repourl,tempdir);
        return {tempdir,folderid}
    }
    catch(e){
        throw new Error(`failed to clone: ${e}`);
    }
};

export const deleteTemp = (tempDir:string)=>{
    if(fs.existsSync(tempDir)){
        fs.rmSync(tempDir,{recursive:true,force:true});
    }
}