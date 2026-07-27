/**
 * EXPRESS SERVER (Port 3000)
 * 
 * This service acts as the standard REST API gateway for the application.
 * Its primary responsibility in this architecture is to receive code execution 
 * requests from the frontend and push them onto a Redis List ("problems").
 * The background Worker service will then pop those jobs off the queue and execute them.
 */
import express from "express";
import { createClient } from "redis";
import cors from 'cors'
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

// Initialize Redis client to push code execution jobs to the worker queue
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

app.get('/', (req, res) => {
    res.send('Hello World!');
})

// Endpoint called by the frontend when a user clicks "Run Code"
app.post('/submit', async (req, res) => {
    const { code, language, roomId,input } = req.body;

    const submissionId = `submission-${Date.now()}-${roomId}`
    console.log(`Received submission from user ${roomId}`);

    try {
        // Push the code execution job onto the "problems" Redis List
        await redisClient.lPush("problems", JSON.stringify({ code, language, roomId, submissionId, input }));

        console.log(
            `Submission pushed to Redis for: ${roomId}  and problem id: ${submissionId}`
        );

        res.status(200).send("Submission received and stored");
    } catch (err) {
        console.log(err);
        res.status(500).send("Failed to store submission");
    }
})

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express Server Listening on port ${PORT}`);
});


async function main() {
    try {
        await redisClient.connect();
        console.log("Redis Client Connected");
    } catch (error) {
        console.log("Failed to connect to Redis", error);
    }
}


main();

