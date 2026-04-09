var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import mongoose from 'mongoose';
import dotenv from "dotenv";
dotenv.config();
export const connectMongoDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const localURI = "mongodb://127.0.0.1:27017/butterflyeffect";
        console.log(`🌿 Connecting to MongoDB at ${process.env.MONGO_URI || localURI}...`);
        const connection = yield mongoose.connect(process.env.MONGO_URI || localURI);
        console.log(`🌿 MongoDB Connected !! HOST: ${connection.connection.host}`);
    }
    catch (error) {
        console.error("MongoDB connection FAILED: ", error);
        process.exit(1);
    }
});
