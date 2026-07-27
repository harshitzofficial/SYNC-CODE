/**
 * WEBSOCKET SERVER (Ports 5000 & 5001)
 * 
 * This service is the real-time heartbeat of the application. It handles:
 * 1. WebRTC Signaling (Offers, Answers, ICE candidates) for P2P video/audio.
 * 2. Real-time Chat and Whiteboard stroke synchronization.
 * 3. AI Pair Programmer streaming responses (via Gemini API).
 * 4. Monaco Editor CRDT synchronization (via a dedicated Yjs server on port 5001).
 * 
 * It is horizontally scalable because it uses Redis Pub/Sub to instantly 
 * broadcast messages across all active server instances.
 */
import http from "http"
import { WebSocketServer } from "ws"
import { createClient } from "redis"
import { error } from "console";
import requestRouter from "./routers/router";
import dotenv from "dotenv";
const { str10_36 } = require('hyperdyperid/lib/str10_36');
const { setupWSConnection } = require('y-websocket/bin/utils');

dotenv.config();

const server = http.createServer();
const wss = new WebSocketServer({ server });
// Subscriber client used to listen to room-specific messages across server instances
const pubSubClient = createClient({
    url: process.env.REDIS_URL
});
// Publisher client used to broadcast messages and maintain the global user roster in Redis Hashes
const publisherClient = createClient({
    url: process.env.REDIS_URL
});

const rooms: any = {};

function generateRoomId() {
    const id: string = str10_36();
    return id;
}

async function start_process() {
    console.log("inside");
    pubSubClient.on("error", (err) => {
        console.log("Redis PubSub Client Error", err);
    })

    // Handle new WebSocket connections from clients
    wss.on("connection", async (ws, req) => {
        try {
        console.log("Connection Established");

        const queryParams = new URLSearchParams(req.url?.split("?")[1]);

        let roomId = queryParams.get("roomId")
        const userId = queryParams.get("id");
        const name = queryParams.get("name");

        if (!roomId || roomId === "" || !rooms[roomId]) {
            if (!roomId) roomId = generateRoomId();
            rooms[roomId] = [];

            ws.send(
                JSON.stringify({
                    isNewRoom: true,
                    type: "roomId",
                    roomId,
                    message: `Created new room with ID : ${roomId}`
                })
            );

            console.log(`Create new room with ID : ${roomId}`);
        } else {
            console.log(`Joining room with ID: ${roomId}`);

            ws.send(
                JSON.stringify({
                    isNewRoom: false,
                    type: "roomId",
                    roomId,
                    message: `Joined room with ID : ${roomId}`
                })
            )
        }

        if (!rooms[roomId]) rooms[roomId] = [];
        rooms[roomId].push({ userId, ws, name });
        console.log("all room", rooms);

        if (userId && name) {
            await publisherClient.hSet(`room:${roomId}:users`, userId, name);
        }

        const allUsersRaw = await publisherClient.hGetAll(`room:${roomId}:users`);
        const allUsers = Object.keys(allUsersRaw).map(id => ({ id, name: allUsersRaw[id] }));

        await publisherClient.publish(roomId, JSON.stringify({
            type: "broadcast",
            excludeUserId: null,
            data: { type: "users", users: allUsers }
        }));

        // If this is the first user in the room on this server instance, subscribe to the Redis Pub/Sub channel
        if (rooms[roomId] && rooms[roomId].length === 1) {
            pubSubClient.subscribe(roomId, (message) => {
                try {
                    const parsed = JSON.parse(message);
                    if (parsed.type === "broadcast") {
                        rooms[roomId]?.forEach((user: any) => {
                            if (user.userId !== parsed.excludeUserId) {
                                user.ws.send(JSON.stringify(parsed.data));
                            }
                        });
                    } else if (parsed.type === "direct") {
                        const targetUser = rooms[roomId]?.find((u: any) => u.userId === parsed.targetUserId);
                        if (targetUser) targetUser.ws.send(JSON.stringify(parsed.data));
                    } else {
                        rooms[roomId]?.forEach((user: any) => {
                            user.ws.send(JSON.stringify({ type: "output", message: message }));
                        });
                    }
                } catch(e) {
                    rooms[roomId]?.forEach((user: any) => {
                        user.ws.send(JSON.stringify({ type: "output", message: message }));
                    });
                }
            }).catch(console.error);
        }

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message.toString());
            } catch (error) {
                console.error("Invalid JSON received:", message.toString());
                return;
            }

            const handler = requestRouter[data.type];
            if (handler) {
                handler(data, { userId, roomId, rooms, publisherClient });
            } else {
                console.warn(`Unknown message type: ${data.type}`);
            }
        });

        ws.on("close", async () => {
            try {
                if (!rooms[roomId]) return;

                rooms[roomId] = rooms[roomId].filter(
                    (user: any) => user.userId !== userId
                );

                if (userId) {
                    await publisherClient.hDel(`room:${roomId}:users`, userId);
                }

                const allUsersRaw = await publisherClient.hGetAll(`room:${roomId}:users`);
                const allUsers = Object.keys(allUsersRaw).map(id => ({ id, name: allUsersRaw[id] }));

                await publisherClient.publish(roomId, JSON.stringify({
                    type: "broadcast",
                    excludeUserId: null,
                    data: { type: "users", users: allUsers }
                }));

                if (rooms[roomId] && rooms[roomId].length === 0) {
                    delete rooms[roomId];
                    pubSubClient.unsubscribe(roomId).catch(console.error);
                }

                console.log("all room", rooms);
            } catch (err) {
                console.error("Error in ws close handler:", err);
            }
        })
        } catch (err) {
            console.error("Error in ws connection handler:", err);
            ws.close();
        }
    })

    wss.on("listening", () => {
        const addr: any = server.address();
        console.log(`Server listening on port ${addr.port}`);
    });
    

    const WS_PORT = Number(process.env.PORT) || 5000;
    server.listen(WS_PORT, '0.0.0.0', () => {
        console.log(`web socket server started on ${WS_PORT}`, server.address());
    });

    // Dedicated Yjs WebSocket server for real-time CRDT code synchronization
    const yjsServer = http.createServer();
    const yjsWss = new WebSocketServer({ server: yjsServer });
    yjsWss.on("connection", setupWSConnection);
    yjsServer.listen(5001, '0.0.0.0', () => {
        console.log("yjs WebSocket Server started on port 5001");
    });
}

async function main() {
    try {
        await pubSubClient.connect();
        await publisherClient.connect();
        await start_process();
        console.log("Redis Client connected");
    } catch (e) {
        console.log("Failed to connect to Redis", error);
    }
}

main();
