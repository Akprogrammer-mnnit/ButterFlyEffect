import mongoose, { Schema } from 'mongoose';
const astNodeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    repoId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    file_path: { type: String, required: true },
    start_line: { type: Number, required: true },
    end_line: { type: Number, required: true },
    code: { type: String, required: true }
});
astNodeSchema.index({ id: 1 });
export default mongoose.model('AstNode', astNodeSchema);
