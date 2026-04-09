var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();
const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;
if (!uri || !password || !user) {
    console.error('Missing neo4j credentials');
    process.exit(1);
}
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionLifetime: 3 * 60 * 60 * 1000,
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000,
    logging: {
        level: 'error',
        logger: (level, message) => console.log(`[neo4j ${level}]: ${message}`)
    }
});
export const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield driver.verifyConnectivity();
        console.log(`connected to neo4j aura db at ${uri}`);
    }
    catch (e) {
        console.error('Neo4j connection failed', e);
        process.exit(1);
    }
});
export const getSession = () => {
    return driver.session();
};
export default driver;
