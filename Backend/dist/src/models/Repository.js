import mongoose, { Schema } from 'mongoose';
const repositorySchema = new Schema({
    url: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
}, { timestamps: true });
export default mongoose.model('Repository', repositorySchema);
