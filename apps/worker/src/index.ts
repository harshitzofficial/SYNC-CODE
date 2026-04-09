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

                executionCommand = `node "${codeFilePath}" "${inputFilePath}"`;
                break;

            case "python":
                codeFilePath = path.join(codeDir, "userCode.py");

                await fs.writeFile(codeFilePath, code);

                executionCommand = `python3 "${codeFilePath}" "${inputFilePath}"`;
                break;

            case "cpp":
                codeFilePath = path.join(codeDir, "userCode.cpp");
                await fs.writeFile(codeFilePath, code);
                executionCommand = `g++ "${codeFilePath}" -o "${path.join(codeDir, "a.out")}" && "${path.join(codeDir, "a.out")}" < "${inputFilePath}"`;
                break;

            case "go":
                codeFilePath = path.join(codeDir, "userCode.go");
                await fs.writeFile(codeFilePath, code);
                executionCommand = `go run "${codeFilePath}" < "${inputFilePath}"`;
                break;

            default: throw new Error("Unsupported language");
        }
    } catch (e) {
        console.error("Failed to prepare code file or Docker command", e);
        return;
    }

    exec(executionCommand, async (error, stdout, stderr) => {
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
    try {
        await client.connect();
        await pubClient.connect();

        console.log("Redis Client Connected");

        while (true) {
            const submission = await client.brPop("problems", 0);

            console.log("Processing submission...");

            if (submission) {
                await processSubmission(submission.element);
            }
        }
    } catch (error) {
        console.error("Failed to connect to Redis", error);
    }
}

main();
