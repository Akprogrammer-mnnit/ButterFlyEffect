var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { simpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';
import { v4 as uuidd } from 'uuid';
const git = simpleGit();
export const cloneRepo = (repourl) => __awaiter(void 0, void 0, void 0, function* () {
    const folderid = uuidd();
    const tempdir = path.join(process.cwd(), 'temp', folderid);
    if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
        fs.mkdirSync(path.join(process.cwd(), 'temp'));
    }
    try {
        yield git.clone(repourl, tempdir);
        return { tempdir, folderid };
    }
    catch (e) {
        throw new Error(`failed to clone: ${e}`);
    }
});
export const deleteTemp = (tempDir) => {
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};
