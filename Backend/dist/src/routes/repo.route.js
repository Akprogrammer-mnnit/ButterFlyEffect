var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Router } from 'express';
import RepoNode from '../models/RepoNode.js';
const router = Router();
router.get('/:repoId/files', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parentPath = req.query.path || '/';
        const nodes = yield RepoNode.find({ repoId: req.params.repoId, parentPath }, { content: 0 } // Optimization: do not return text content for tree view
        ).sort({ type: 1, name: 1 });
        res.status(200).json(nodes);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}));
// 2. Get specific file content
router.get('/:repoId/file-content', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filePath = req.query.filePath;
        if (!filePath) {
            return res.status(400).json({ error: 'filePath query parameter is required' });
        }
        const file = yield RepoNode.findOne({
            repoId: req.params.repoId,
            path: filePath,
            type: 'file'
        });
        if (!file)
            return res.status(404).json({ error: 'File not found' });
        res.status(200).json(file);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}));
// 3. Search for a keyword/function across the repository
router.get('/:repoId/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const query = req.query.query;
        if (!query) {
            return res.status(400).json({ error: 'query parameter is required' });
        }
        const results = yield RepoNode.find({ repoId: req.params.repoId, $text: { $search: query } }, { score: { $meta: 'textScore' }, content: 0 } // Exclude full content, include relevancy score
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(50);
        res.status(200).json(results);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}));
export default router;
