// --- IMPORTS ---
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { userAtom } from '../atoms/userAtom'; // Global state for the current user
import { useNavigate, useParams } from 'react-router-dom'; // Hooks for routing/navigation
import { socketAtom } from '../atoms/socketAtom'; // Global state for the WebSocket connection
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiCode, FiUsers, FiUser, FiHash } from 'react-icons/fi'; // Icons for the UI
import { motion } from 'framer-motion'; // Library for smooth animations
import { GridPattern } from "../components/ui/aceternity/grid-pattern"; // UI background component

export const Register = () => {
    // --- LOCAL STATE ---
    // Manages the input fields and loading state just for this screen
    const [name, setName] = useState<string>("");
    const [roomId, setRoomId] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    // --- GLOBAL STATE (RECOIL) ---
    // Accesses global state so the socket and user data can be shared with other components (like the code editor)
    const [socket, setSocket] = useRecoilState<WebSocket | null>(socketAtom);
    const [user, setUser] = useRecoilState(userAtom);

    // --- ROUTER HOOKS ---
    const params = useParams(); // Grabs variables from the URL (e.g., /register/123 -> 123 is the roomId)
    const navigate = useNavigate(); // Allows us to programmatically change pages

    // Helper function to generate a random 5-digit user ID
    function generateId() {
        const id = Math.floor(Math.random() * 100000);
        return id.toString();
    }

    // --- CORE LOGIC: WEBSOCKET CONNECTION ---
    // This function handles creating a user, connecting to the backend server, and joining a room
    const initializeSocket = () => {
        setLoading(true); // Disable buttons while connecting
        let generatedId = "";

        // 1. Check if the user already has an ID in global state. If not, generate one.
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

        // 2. Only create a new WebSocket connection if one doesn't exist, or if the old one closed
        if (!socket || socket.readyState === WebSocket.CLOSED) {
            console.log("inside");
            
            // Prepare user data for the connection URL
            const u = {
                id: user.id == "" ? generatedId : user.id,
                name: name
            }

            console.log(user.id)

            // Guard clause: Ensure the user typed a name before attempting to connect
            if (name == "") {
                alert("Please enter a name to continue");
                setLoading(false);
                return;
            }

            // 3. Establish the actual WebSocket connection to the backend server
            // Passes roomId, id, and name as query parameters in the URL
            const ws = new WebSocket(`${import.meta.env.VITE_WEBSOCKET_SERVER_URL}?roomId=${roomId}&id=${u.id}&name=${u.name}`);

            // Save this connection to global state so the rest of the app can use it
            setSocket(ws);

            // --- WEBSOCKET EVENT LISTENERS ---
            
            // Triggered when the connection is successfully opened
            ws.onopen = () => {
                console.log("Connected to WebSocket");
            }

            // Triggered whenever the backend sends a message to the client
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                // If the server confirms our room ID...
                if (data.type == "roomId") {
                    setRoomId(data.roomId);
                    console.log("Room ID: ", data.roomId);
                    
                    // Update global user state to include the confirmed room ID
                    setUser({
                        id: user.id == "" ? generateId() : user.id,
                        name: name,
                        roomId: data.roomId
                    });
                    
                    setLoading(false);
                    // 4. Navigate the user away from the register page and into the actual code editor room!
                    navigate("/code/" + data.roomId);
                }
            };

            // Triggered if the connection fails
            ws.onerror = (error) => {
                console.error("WebSocket Error:", error);
                alert("Failed to connect to the server. Please make sure the WebSocket server is running.");
                setLoading(false);
            };

            // Triggered when the connection drops
            ws.onclose = () => {
                console.log("WebSocket connnection closed from register page");
                setLoading(false);
            }
        } else {
            // If socket already existed and was open, just stop loading
            setLoading(false);
        }
    }

    // --- BUTTON HANDLERS ---
    
    // Called when user clicks "Create New Room"
    const handleNewRoom = () => {
        console.log("new room opened")
        if (!loading) {
            initializeSocket(); // Triggers socket init (empty roomId means server will generate a new one)
        }
    }

    // Called when user clicks "Join Existing Room"
    const handleJoinRoom = () => {
        if (roomId != "" && !loading) {
            initializeSocket(); // Triggers socket init with the provided roomId
        } else {
            alert("Please enter a valid room ID"); // Prevents joining without an ID
        }
    }

    // --- INITIALIZATION ---
    // Runs exactly once when the component first loads onto the screen
    useEffect(() => {
        console.log(params.roomId)
        // If the user arrived via a shared link (e.g., domain.com/register/xyz), pre-fill the Room ID input
        setRoomId(params.roomId || "");
    }, [])

    // --- UI RENDER (JSX) ---
    return (
        <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 py-8 flex items-start justify-center">
            {/* Cool background pattern */}
            <GridPattern /> 
            
            <div className="w-full max-w-md px-4 sm:px-0 relative z-10 mt-8 mb-8">
                {/* Framer Motion wrapper to make the form slide up and fade in smoothly */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full"
                >
                    {/* Header Section */}
                    <div className="mb-8 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <FiCode className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">CodeSync</h1>
                        <p className="text-gray-400">Real-time collaborative coding platform</p>
                    </div>

                    {/* Form Section */}
                    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl p-6 border border-gray-700/50">
                        <div className="space-y-5">
                            
                            {/* Name Input */}
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
                                        onChange={(e) => setName(e.target.value)} // Updates 'name' state as user types
                                        className="pl-10 bg-gray-900/70 border-gray-700 text-white focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Room ID Input */}
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
                                        onChange={(e) => setRoomId(e.target.value)} // Updates 'roomId' state as user types
                                        className="pl-10 bg-gray-900/70 border-gray-700 text-white focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-400">Leave empty to create a new room</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 space-y-3">
                                {/* Create Room Button - Disabled if loading or if no name is entered */}
                                <Button
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                                    disabled={loading || !name}
                                    onClick={handleNewRoom}
                                >
                                    <FiCode className="h-4 w-4" />
                                    {loading ? 'Creating...' : 'Create New Room'}
                                </Button>

                                {/* Join Room Button - Disabled if loading, no name, or no Room ID is entered */}
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