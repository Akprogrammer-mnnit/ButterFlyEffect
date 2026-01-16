import dotenv from 'dotenv';
dotenv.config({path:'./.env'})

import app from './app'
import { connectDB } from '../db/index';


connectDB()
.then(()=>{
    const PORT = process.env.PORT || 5555
    app.listen(PORT,()=>{
        console.log(`server running at port ${PORT}`);
    })
})
.catch((e)=>{
    console.log(`neo4j connection error ${e}`);
    process.exit(1);
})
