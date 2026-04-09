import mongoose from 'mongoose';
import dotenv from "dotenv"
dotenv.config();
const DB_NAME = "ButterflyEffect";
export const connectMongoDB = async () => {

    try {
        const connection = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`🌿 MongoDB Connected !! HOST: ${connection.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection FAILED: ", error);
        process.exit(1);
    }
};