import mongoose, { Document, Schema } from 'mongoose';

export interface IRepoNode extends Document {
  repoId: mongoose.Types.ObjectId;
  type: 'file' | 'folder';
  name: string;
  path: string;
  parentPath: string;
  size: number;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const repoNodeSchema: Schema = new Schema({
  repoId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
  type: { type: String, enum: ['file', 'folder'], required: true },
  name: { type: String, required: true },
  path: { type: String, required: true },
  parentPath: { type: String, required: true },
  size: { type: Number, default: 0 },
  content: { type: String, default: null } // Null for folders
}, { timestamps: true });

repoNodeSchema.index({ repoId: 1, path: 1 }, { unique: true });
repoNodeSchema.index({ repoId: 1, parentPath: 1 });
repoNodeSchema.index({ name: 'text', content: 'text' });

export default mongoose.model<IRepoNode>('RepoNode', repoNodeSchema);