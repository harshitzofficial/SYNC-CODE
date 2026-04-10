import { createClient } from 'redis';
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.REDIS_URL,
});

const pubClient = createClient({
    url: process.env.REDIS_URL,
});

async function processSubmission(submission: any) {
    const { code, language, roomId, submissionId, input } = JSON.parse(submission);

    console.log(JSON.stringify(submission));

    console.log(`Processing submission for room id: ${roomId}, submission id: ${submissionId}`);

    const codeDir = path.resolve(`./tmp/user-${Date.now()}`);
    await fs.mkdir(codeDir, { recursive: true });


    let codeFilePath = "";
    let executionCommand = "";

    const inputFilePath = path.join(codeDir, "input.txt");


    try {
        await fs.writeFile(inputFilePath, input, "utf8");

        switch (language) {
            case "javascript":
                codeFilePath = path.join(codeDir, "userCode.js");
                await fs.writeFile(codeFilePath, code);

                executionCommand = `docker run --rm --memory="100m" --cpus="0.5" --network none -v "${codeDir}:/usr/src/app" -w /usr/src/app node:18-alpine node userCode.js input.txt`;
                break;

            case "python":
                codeFilePath = path.join(codeDir, "userCode.py");

                await fs.writeFile(codeFilePath, code);

                executionCommand = `docker run --rm --memory="100m" --cpus="0.5" --network none -v "${codeDir}:/usr/src/app" -w /usr/src/app python:3.9-alpine python userCode.py input.txt`;
                break;

            case "cpp":
                codeFilePath = path.join(codeDir, "userCode.cpp");
                await fs.writeFile(codeFilePath, code);
                executionCommand = `docker run --rm --memory="100m" --cpus="0.5" --network none -v "${codeDir}:/usr/src/app" -w /usr/src/app gcc:latest sh -c "g++ userCode.cpp -o a.out && ./a.out < input.txt"`;
                break;

            case "go":
                codeFilePath = path.join(codeDir, "userCode.go");
                await fs.writeFile(codeFilePath, code);
                executionCommand = `docker run --rm --memory="100m" --cpus="0.5" --network none -v "${codeDir}:/usr/src/app" -w /usr/src/app golang:1.20-alpine sh -c "go run userCode.go < input.txt"`;
                break;

            default: throw new Error("Unsupported language");
        }
    } catch (e) {
        console.error("Failed to prepare code file or Docker command", e);
        return;
    }

    exec(executionCommand, { timeout: 10000 }, async (error, stdout, stderr) => {
        let result = stdout || stderr;
        if (error) {
            result = `Error: ${error.message}`;
        }

        console.log(`Result for room ${roomId}: ${result}`);

        try {
            await pubClient.publish(roomId, result);
        } catch (e) {
            console.error("Failed to publish result to Redis,", e)
        }

        try {
            await fs.rm(codeDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error("Failed to clean up directory:", cleanupError);
        }
    })
}

async function main() {
    while (true) {
        try {
            if (!client.isOpen) await client.connect();
            if (!pubClient.isOpen) await pubClient.connect();

            console.log("Redis Client Connected");

            while (true) {
                const submission = await client.brPop("problems", 0);
                if (submission) {
                    await processSubmission(submission.element);
                }
            }
        } catch (error) {
            console.error("Failed to connect or communicating with Redis. Retrying in 5s...", error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main();
