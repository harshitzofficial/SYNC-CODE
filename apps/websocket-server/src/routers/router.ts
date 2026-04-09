
export type MessageTypes =
    | "requestToGetUsers"
    | "requestForAllData"
    | "code"
    | "input"
    | "language"
    | "submitBtnStatus"
    | "users"
    | "allData"
    | "cursorPosition"
    | "webrtc_offer"
    | "webrtc_answer"
    | "webrtc_ice_candidate"
    | "chat_message"
    | "whiteboard_stroke"
    | "whiteboard_clear"

interface MessageHandler {
    ( data: any, context: { userId: string | null, roomId: string, rooms: any }): void;
}

const requestRouter: Record<string, MessageHandler> = {
    requestToGetUsers: ( data, { userId, roomId, rooms }) => {
        const users = rooms[roomId].map((user: any) => ({
            id: user.userId,
            name: user.name,
        }));

        rooms[roomId].forEach((user: any) => {
            user.ws.send(JSON.stringify({ type: "users", users }));
        });
    },
    
    requestForAllData: ( data, { userId, roomId, rooms }) => {
        const otherUser = rooms[roomId].find(
            (user: any) => user.userId !== userId
        );

        if (otherUser) {
            otherUser.ws.send(
                JSON.stringify({
                    type: "requestForAllData",
                    userId: userId,
                })
            );
        }
    },

    code: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, { type: "code", code: data.code });
    },

    input: ( data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, { type: "input", input: data.input });
    },

    language: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, { type: "language", language: data.language });
    },

    submitBtnStatus: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, {
            type: "submitBtnStatus",
            value: data.value,
            isLoading: data.isLoading,
        });
    },

    users: ( data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, { type: "users", users: data.users });
    },

    allData: ( data, { userId, roomId, rooms }) => {
        const targetUser = rooms[roomId].find((user: any) => user.userId === data.userId);
        if (targetUser) {
            targetUser.ws.send(
                JSON.stringify({
                    type: "allData",
                    code: data.code,
                    input: data.input,
                    language: data.language,
                    currentButtonState: data.currentButtonState,
                    isLoading: data.isLoading,
                })
            );
        }
    },

    cursorPosition: ( data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, {
            type: "cursorPosition",
            cursorPosition: data.cursorPosition,
            userId: userId,
        });
    },

    webrtc_offer: (data, { userId, roomId, rooms }) => {
        sendToUser(rooms[roomId], data.targetUserId, {
            type: "webrtc_offer",
            offer: data.offer,
            senderId: userId
        });
    },

    webrtc_answer: (data, { userId, roomId, rooms }) => {
        sendToUser(rooms[roomId], data.targetUserId, {
            type: "webrtc_answer",
            answer: data.answer,
            senderId: userId
        });
    },

    webrtc_ice_candidate: (data, { userId, roomId, rooms }) => {
        sendToUser(rooms[roomId], data.targetUserId, {
            type: "webrtc_ice_candidate",
            candidate: data.candidate,
            senderId: userId
        });
    },

    chat_message: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, {
            type: "chat_message",
            text: data.text,
            imageUrl: data.imageUrl,
            senderId: userId,
            senderName: data.senderName,
            timestamp: data.timestamp
        });
    },

    whiteboard_stroke: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, {
            type: "whiteboard_stroke",
            stroke: data.stroke
        });
    },

    whiteboard_clear: (data, { userId, roomId, rooms }) => {
        broadcastToOthers(rooms[roomId], userId, {
            type: "whiteboard_clear"
        });
    },
};

function broadcastToOthers(roomUsers: any[], excludeUserId: string | null, message: any) {
    roomUsers.forEach((user: any) => {
        if (user.userId !== excludeUserId) {
            user.ws.send(JSON.stringify(message));
        }
    });
}

function sendToUser(roomUsers: any[], targetUserId: string, message: any) {
    if (!roomUsers) return;
    const targetUser = roomUsers.find((user: any) => user.userId === targetUserId);
    if (targetUser) {
        targetUser.ws.send(JSON.stringify(message));
    }
}

export default requestRouter