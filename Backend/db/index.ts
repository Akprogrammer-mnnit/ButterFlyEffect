import neo4j, {Driver,Session} from 'neo4j-driver'
import dotenv from 'dotenv';

dotenv.config({path:'./.env'});

const uri = process.env.NEO4J_URI as string;
const user = process.env.NEO4J_USER as string;
const password = process.env.NEO4J_PASSWORD as string;

if(!uri || !password || !user){
    console.error('Missing neo4j credentials');
    process.exit(1);
}

const driver: Driver = neo4j.driver(
    uri,
    neo4j.auth.basic(user,password),
    {
        maxConnectionLifetime:3*60*60*1000,
        maxConnectionPoolSize:50,
        connectionAcquisitionTimeout:2*60*1000,
        logging:{
            level:'info',
            logger:(level,message)=> console.log(`[neo4j ${level}]: ${message}`)
        }
    }
);

export const connectDB = async ()=>{
    try{
        await driver.verifyConnectivity();
        console.log(`connected to neo4j aura db at ${uri}`);
    }
    catch(e){
        console.error('Neo4j connection failed',e);
        process.exit(1);
    }
}


export const getSession = (): Session => {
    return driver.session();
};

export default driver;