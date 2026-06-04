import dotenv from 'dotenv';
dotenv.config({ path: './.env' })
import app from './app.js';
import { connectDB } from '../db/index.js';
import { connectMongoDB } from '../db/mongo.js';
import './services/bullmq.service.js';

connectDB()
    .then(() => {
        connectMongoDB()
            .then(() => {
                const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5555;
                app.listen(PORT, "0.0.0.0", () => {
                    console.log(`🚀 Server is running on port ${PORT}`);
                });
            })
            .catch((err) => {
                console.error("Failed to connect to MongoDB:", err);
                process.exit(1);
            });
    })
    .catch((err) => {
        console.error("Failed to connect to Neo4j:", err);
        process.exit(1);
    });

