import mongoose from 'mongoose';

export const connectMongoDB = async () => {
    try {
        const localURI = "mongodb://127.0.0.1:27017/butterflyeffect";
        const connection = await mongoose.connect(localURI);
        console.log(`🌿 MongoDB Connected !! HOST: ${connection.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection FAILED: ", error);
        process.exit(1); 
    }
};