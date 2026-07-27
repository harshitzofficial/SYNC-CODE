// --- IMPORTS ---
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { userAtom } from '../atoms/userAtom'; // Global state for the current user
import { Link, useNavigate, useParams } from 'react-router-dom'; // Hooks for routing/navigation
import { socketAtom } from '../atoms/socketAtom'; // Global state for the WebSocket connection
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiArrowLeft, FiCode, FiHash, FiUser, FiUsers, FiZap } from 'react-icons/fi'; // Icons for the UI
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
    const initializeSocket = (overrideRoomId?: string) => {
        // Guard clause: Ensure the user typed a name before attempting to connect
        if (name == "") {
            alert("Please enter a name to continue");
            return;
        }

        setLoading(true); // Disable buttons while connecting
        const currentUserId = user.id || generateId();
        const finalRoomId = overrideRoomId !== undefined ? overrideRoomId : roomId;

        // Only create a new WebSocket connection if one doesn't exist, or if the old one closed
        if (!socket || socket.readyState === WebSocket.CLOSED) {
            console.log("inside");

            // Establish the actual WebSocket connection to the backend server
            // Passes roomId, id, and name as query parameters in the URL
            const ws = new WebSocket(`${import.meta.env.VITE_WEBSOCKET_SERVER_URL}?roomId=${finalRoomId}&id=${currentUserId}&name=${name}`);

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
                        id: currentUserId,
                        name: name,
                        roomId: data.roomId
                    });

                    setLoading(false);
                    // Navigate the user away from the register page and into the actual code editor room!
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
            setRoomId("");
            initializeSocket(""); // Triggers socket init (empty roomId means server will generate a new one)
        }
    }

    // Called when user clicks "Join Existing Room"
    const handleJoinRoom = () => {
        if (roomId != "" && !loading) {
            initializeSocket(roomId); // Triggers socket init with the provided roomId
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
        <div className="relative min-h-screen w-full overflow-hidden bg-[#080c16] py-6 text-slate-100 sm:py-10">
            <GridPattern />
            <div className="premium-grid pointer-events-none absolute inset-0 opacity-40" />
            <div className="pointer-events-none absolute left-[-9rem] top-[-11rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-[-12rem] right-[-5rem] h-[30rem] w-[30rem] rounded-full bg-indigo-500/15 blur-[130px]" />

            <div className="relative z-10 mx-auto w-full max-w-5xl px-5 sm:px-8">
                <div className="mb-10 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-300 transition hover:text-white"><FiArrowLeft /> Back to home</Link>
                    <div className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600"><FiCode /></span>CodeSync</div>
                </div>
                <div className="grid items-center gap-10 lg:grid-cols-[.85fr_1fr]">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45 }} className="hidden lg:block">
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300"><FiZap size={23} /></div>
                        <p className="mb-4 text-xs font-bold tracking-[.16em] text-cyan-300">READY WHEN YOU ARE</p>
                        <h1 className="max-w-md text-5xl font-extrabold leading-[1.05] tracking-[-.05em] text-white">Join the flow.<br /><span className="text-slate-400">Make progress together.</span></h1>
                        <p className="mt-6 max-w-sm text-base leading-7 text-slate-400">Open a shared space for your team in seconds. Your code, conversations, and ideas stay side by side.</p>
                        <div className="mt-10 space-y-4 border-l border-white/10 pl-5 text-sm text-slate-400"><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-cyan-300" />Live code collaboration</p><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-indigo-300" />Chat, video, and whiteboard</p><p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-300" />Share a room with one code</p></div>
                    </motion.div>
                    <div className="w-full max-w-md justify-self-center">
                        {/* Framer Motion wrapper to make the form slide up and fade in smoothly */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="w-full"
                        >
                            <div className="mb-7 text-center lg:hidden">
                                <div className="mb-4 flex justify-center">
                                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-950/40">
                                        <FiCode className="h-7 w-7 text-white" />
                                    </div>
                                </div>
                                <h1 className="text-3xl font-extrabold tracking-tight text-white">Your shared workspace</h1>
                                <p className="mt-2 text-sm text-slate-400">Create a room or join your team.</p>
                            </div>

                            <div className="rounded-2xl border border-white/[.12] bg-[#111a2b]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
                                <div className="mb-7 hidden lg:block"><h2 className="text-2xl font-extrabold tracking-tight text-white">Enter your workspace</h2><p className="mt-2 text-sm text-slate-400">Add your details to start collaborating.</p></div>
                                <div className="space-y-5">

                                    {/* Name Input */}
                                    <div>
                                        <label htmlFor="name" className="mb-2 block text-sm font-bold text-slate-200">Your name</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FiUser className="text-slate-500" />
                                            </div>
                                            <Input
                                                id="name"
                                                type="text"
                                                placeholder="e.g. Harshit Singh"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)} // Updates 'name' state as user types
                                                className="h-12 rounded-xl border-white/10 bg-[#080e1b]/80 pl-10 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20"
                                            />
                                        </div>
                                    </div>

                                    {/* Room ID Input */}
                                    <div>
                                        <div className="mb-2 flex items-center justify-between"><label htmlFor="roomId" className="block text-sm font-bold text-slate-200">Room code</label><span className="text-xs text-slate-500">Optional</span></div>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FiHash className="text-slate-500" />
                                            </div>
                                            <Input
                                                id="roomId"
                                                type="text"
                                                placeholder="Paste a shared room code"
                                                value={roomId}
                                                onChange={(e) => setRoomId(e.target.value)} // Updates 'roomId' state as user types
                                                className="h-12 rounded-xl border-white/10 bg-[#080e1b]/80 pl-10 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20"
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">Leave blank and we’ll create a private room for you.</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-3 pt-2">
                                        {/* Create Room Button - Disabled if loading or if no name is entered */}
                                        <Button
                                            className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-extrabold text-slate-950 shadow-lg shadow-cyan-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-300 hover:to-blue-400 flex items-center justify-center gap-2"
                                            disabled={loading || !name}
                                            onClick={handleNewRoom}
                                        >
                                            <FiCode className="h-4 w-4" />
                                            {loading ? 'Connecting...' : 'Create new room'}
                                        </Button>

                                        {/* Join Room Button - Disabled if loading, no name, or no Room ID is entered */}
                                        <Button
                                            className="h-12 w-full rounded-xl border border-white/10 bg-white/[.055] font-bold text-white transition-all duration-200 hover:border-white/20 hover:bg-white/[.09] flex items-center justify-center gap-2"
                                            disabled={loading || !roomId || !name}
                                            onClick={handleJoinRoom}
                                        >
                                            <FiUsers className="h-4 w-4" />
                                            {loading ? 'Connecting...' : 'Join with room code'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
                <p className="mt-8 text-center text-xs text-slate-600">A focused room for shared thinking and better code.</p>
            </div>
        </div>
    );
};
