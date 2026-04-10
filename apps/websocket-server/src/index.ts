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
const pubSubClient = createClient({
    url: process.env.REDIS_URL
});
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

    wss.on("connection", async (ws, req) => {
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

        if (rooms[roomId].length === 1) {
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
            });
        }

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message.toString());
            } catch (error) {
                console.error("Invalid JSON received:", message.toString());
                return;
            }

            console.log("Message received", data.type);

            // if (data.type === "requestToGetUsers") {
            //     const users = rooms[roomId].map((user: any) => ({
            //         id: user.userId,
            //         name: user.name,
            //     }));

            //     console.log("Request recived");

            //     rooms[roomId].forEach((user: any) => {
            //         user.ws.send(JSON.stringify({ type: "users", users: users }));
            //     });
            // }

            // if (data.type === 'requestForAllData') {
            //     const otherUser = rooms[roomId].find(
            //         (user: any) => user.userId !== userId
            //     );

            //     if (otherUser) {
            //         console.log("sending request to", otherUser.name);
            //         otherUser.ws.send(
            //             JSON.stringify({
            //                 type: "requestForAllData",
            //                 userId: userId,
            //             })
            //         );
            //     }
            // }

            // if (data.type === "code") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(JSON.stringify({ type: "code", code: data.code }));
            //         }
            //     });
            // }

            // if (data.type === "input") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(JSON.stringify({ type: "input", input: data.input }));
            //         }
            //     });
            // }

            // if (data.type === "language") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(
            //                 JSON.stringify({ type: "language", language: data.language })
            //             );
            //         }
            //     });
            // }

            // if (data.type === "submitBtnStatus") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(
            //                 JSON.stringify({
            //                     type: "submitBtnStatus",
            //                     value: data.value,
            //                     isLoading: data.isLoading,
            //                 })
            //             );
            //         }
            //     });
            // }

            // // handle user added
            // if (data.type === "users") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(JSON.stringify({ type: "users", users: data.users }));
            //         }
            //     });
            // }

            // if (data.type === "allData") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId === data.userId) {
            //             console.log("sending all data to", user.name, "and data is", data);

            //             user.ws.send(
            //                 JSON.stringify({
            //                     type: "allData",
            //                     code: data.code,
            //                     input: data.input,
            //                     language: data.language,
            //                     currentButtonState: data.currentButtonState,
            //                     isLoading: data.isLoading,
            //                 })
            //             );
            //         }
            //     });
            // }

            // if (data.type === "cursorPosition") {
            //     rooms[roomId].forEach((user: any) => {
            //         if (user.userId != userId) {
            //             user.ws.send(
            //                 JSON.stringify({
            //                     type: "cursorPosition",
            //                     cursorPosition: data.cursorPosition,
            //                     userId: userId,
            //                 })
            //             );
            //         }
            //     });
            // }

            const handler = requestRouter[data.type];
            if (handler) {
                handler(data, { userId, roomId, rooms, publisherClient });
            } else {
                console.warn(`Unknown message type: ${data.type}`);
            }
        });

        ws.on("close", async () => {
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

            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
                pubSubClient.unsubscribe(roomId);
            }

            console.log("all room", rooms);
        })

    })

    wss.on("listening", () => {
        const addr: any = server.address();
        console.log(`Server listening on port ${addr.port}`);
    });
    

    const WS_PORT = process.env.PORT || 5000;
    server.listen(WS_PORT, '0.0.0.0', () => {
        console.log(`web socket server started on ${WS_PORT}`, server.address());
    });

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
