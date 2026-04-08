import mongoose, { Document, Schema } from 'mongoose';

export interface IRepository extends Document {
  url: string;
  name: string;
  status: 'pending' | 'synced' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema: Schema = new Schema({
  url: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
}, { timestamps: true });

export default mongoose.model<IRepository>('Repository', repositorySchema);