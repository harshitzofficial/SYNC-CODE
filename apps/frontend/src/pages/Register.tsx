import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { userAtom } from '../atoms/userAtom';
import { useNavigate, useParams } from 'react-router-dom';
import { socketAtom } from '../atoms/socketAtom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiCode, FiUsers, FiUser, FiHash } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { GridPattern } from "../components/ui/aceternity/grid-pattern";

export const Register = () => {
    const [name, setName] = useState<string>("");
    const [roomId, setRoomId] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [socket, setSocket] = useRecoilState<WebSocket | null>(socketAtom);
    const [user, setUser] = useRecoilState(userAtom);

    const params = useParams();
    const navigate = useNavigate();

    function generateId() {
        const id = Math.floor(Math.random() * 100000);
        return id.toString();
    }

    const initializeSocket = () => {
        setLoading(true);
        let generatedId = "";

        if (user.id == "") {
            console.log("user_id generated")
            generatedId = generateId();
            setUser({
                id: generatedId,
                name: name,
                roomId: ""
            });
        }

        console.log(generatedId);
        console.log(!socket)

        if (!socket || socket.readyState === WebSocket.CLOSED) {
            console.log("inside");
            const u = {
                id: user.id == "" ? generatedId : user.id,
                name: name
            }

            console.log(user.id)

            if (name == "") {
                alert("Please enter a name to continue");
                setLoading(false);
                return;
            }

            const ws = new WebSocket(`${import.meta.env.VITE_WEBSOCKET_SERVER_URL}?roomId=${roomId}&id=${u.id}&name=${u.name}`);

            setSocket(ws);

            ws.onopen = () => {
                console.log("Connected to WebSocket");
            }

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type == "roomId") {
                    setRoomId(data.roomId);
                    console.log("Room ID: ", data.roomId);
                    setUser({
                        id: user.id == "" ? generateId() : user.id,
                        name: name,
                        roomId: data.roomId
                    });
                    setLoading(false);
                    navigate("/code/" + data.roomId);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket Error:", error);
                alert("Failed to connect to the server. Please make sure the WebSocket server is running.");
                setLoading(false);
            };

            ws.onclose = () => {
                console.log("WebSocket connnection closed from register page");

                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }

    const handleNewRoom = () => {
        console.log("new room opened")
        if (!loading) {
            initializeSocket();
        }
    }

    const handleJoinRoom = () => {
        if (roomId != "" && !loading) {
            initializeSocket();
        } else {
            alert("Please enter a valid room ID");
        }
    }

    useEffect(() => {
        console.log(params.roomId)
        setRoomId(params.roomId || "");
    }, [])

    return (
        <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 py-8 flex items-start justify-center">
            <GridPattern />
            <div className="w-full max-w-md px-4 sm:px-0 relative z-10 mt-8 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full"
                >
                    <div className="mb-8 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <FiCode className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">CodeSync</h1>
                        <p className="text-gray-400">Real-time collaborative coding platform</p>
                    </div>

                    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-700/50">
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiUser className="text-gray-500" />
                                    </div>
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="Enter your name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10 bg-gray-900/70 border-gray-700 text-white focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="roomId" className="block text-sm font-medium text-gray-300 mb-1.5">Room ID</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiHash className="text-gray-500" />
                                    </div>
                                    <Input
                                        id="roomId"
                                        type="text"
                                        placeholder="Room ID (Optional)"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value)}
                                        className="pl-10 bg-gray-900/70 border-gray-700 text-white focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-400">Leave empty to create a new room</p>
                            </div>

                            <div className="pt-2 space-y-3">
                                <Button
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                    disabled={loading || !name}
                                    onClick={handleNewRoom}
                                >
                                    <FiCode className="h-4 w-4" />
                                    {loading ? 'Creating...' : 'Create New Room'}
                                </Button>

                                <Button
                                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 border border-gray-600/50"
                                    disabled={loading || !roomId || !name}
                                    onClick={handleJoinRoom}
                                >
                                    <FiUsers className="h-4 w-4" />
                                    {loading ? 'Joining...' : 'Join Existing Room'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    
                </motion.div>
            </div>
        </div>
    );
};
