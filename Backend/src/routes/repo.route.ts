import { Router, Request, Response } from 'express';
import RepoNode from '../models/RepoNode.js';

const router = Router();

router.get('/:repoId/files', async (req: Request, res: Response) => {
  try {
    const parentPath = (req.query.path as string) || '/';

    const nodes = await RepoNode.find(
      { repoId: req.params.repoId, parentPath },
      { content: 0 } // Optimization: do not return text content for tree view
    ).sort({ type: 1, name: 1 });

    res.status(200).json(nodes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get specific file content
router.get('/:repoId/file-content', async (req: Request, res: Response): Promise<any> => {
  try {
    const filePath = req.query.filePath as string;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath query parameter is required' });
    }

    const file = await RepoNode.findOne({
      repoId: req.params.repoId,
      path: filePath,
      type: 'file'
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    res.status(200).json(file);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Search for a keyword/function across the repository
router.get('/:repoId/search', async (req: Request, res: Response): Promise<any> => {
  try {
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const results = await RepoNode.find(
      { repoId: req.params.repoId, $text: { $search: query } },
      { score: { $meta: 'textScore' }, content: 0 } // Exclude full content, include relevancy score
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(50);

    res.status(200).json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;