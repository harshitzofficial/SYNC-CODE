import { Users, Copy, Check, Mic, MicOff, Camera, CameraOff, Video as VideoIcon, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface User {
    id: string;
    name: string;
}

interface UserListProps {
    users: User[];
    roomId: string;
    localUserId?: string;
    localUserName?: string;
    localStream?: MediaStream | null;
    remoteStreams?: Record<string, MediaStream>;
    micEnabled?: boolean;
    videoEnabled?: boolean;
    toggleMic?: () => void;
    toggleVideo?: () => void;
}

const VideoStream = ({ stream, muted = false, onClick }: { stream: MediaStream | null, muted?: boolean, onClick?: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div 
            onClick={onClick}
            className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700 w-full aspect-video mt-2 cursor-pointer hover:border-blue-500 transition-colors shadow-md"
        >
            {stream ? (
                <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
            ) : (
                <div className="flex items-center justify-center h-full w-full bg-gray-800 text-gray-500">
                    <VideoIcon size={24} />
                </div>
            )}
            <div className="absolute top-2 right-2 bg-black/60 rounded px-2 py-1 text-xs text-white opacity-0 hover:opacity-100 transition-opacity">
                Click to Zoom
            </div>
        </div>
    );
};

export const UserList = ({ 
    users, roomId, localUserId, localUserName, localStream, remoteStreams, 
    micEnabled, videoEnabled, toggleMic, toggleVideo 
}: UserListProps) => {
    const [copied, setCopied] = useState(false);
    const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
    const [zoomedStream, setZoomedStream] = useState<{ stream: MediaStream | null, label: string } | null>(null);

    const copyInviteCode = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            setCopied(true);
            toast.message("Copied!", { description: "Invitation code copied to clipboard" });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Error", { description: "Failed to copy invitation code" });
        }
    };

    const generateUserColor = (name: string) => {
        const colors = [
            "bg-gradient-to-br from-purple-500 to-pink-500",
            "bg-gradient-to-br from-blue-500 to-cyan-500",
            "bg-gradient-to-br from-green-500 to-emerald-500",
            "bg-gradient-to-br from-orange-500 to-red-500",
            "bg-gradient-to-br from-indigo-500 to-purple-500",
            "bg-gradient-to-br from-yellow-500 to-orange-500",
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedUsers(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const remoteUsers = users.filter(u => u.id !== localUserId && u.name !== localUserName);

    return (
        <>
            <div className="space-y-4">
                {/* Users Section */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-blue-400" />
                        <h3 className="text-lg font-semibold text-white">
                            Users ({users.length})
                        </h3>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                        
                        {/* Local User First */}
                        {localUserName && (
                            <div className="flex flex-col p-3 bg-blue-900/40 rounded-lg border border-blue-500/30 transition-all duration-200">
                                <div 
                                    className="flex items-center gap-3 cursor-pointer"
                                    onClick={(e) => toggleExpand('local', e)}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${generateUserColor(localUserName)} shadow-lg`}>
                                        {localUserName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{localUserName} (You)</p>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-xs text-green-400">Active</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); toggleMic?.(); }} className={`p-1.5 rounded-full ${micEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} text-white transition-colors`}>
                                            {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); toggleVideo?.(); }} className={`p-1.5 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} text-white transition-colors`}>
                                            {videoEnabled ? <Camera size={14} /> : <CameraOff size={14} />}
                                        </button>
                                    </div>
                                </div>
                                {expandedUsers['local'] && (
                                    <VideoStream stream={localStream || null} muted={true} onClick={() => setZoomedStream({ stream: localStream || null, label: 'You' })} />
                                )}
                            </div>
                        )}

                        {/* Remote Users */}
                        {remoteUsers.map((user) => (
                            <div key={user.id} className="flex flex-col p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                                <div 
                                    className="flex items-center gap-3 cursor-pointer"
                                    onClick={(e) => toggleExpand(user.id, e)}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${generateUserColor(user.name)} shadow-lg`}>
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{user.name}</p>
                                        <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-xs text-green-400">Active</span>
                                        </div>
                                    </div>
                                </div>
                                {expandedUsers[user.id] && (
                                    <VideoStream stream={remoteStreams?.[user.id] || null} onClick={() => setZoomedStream({ stream: remoteStreams?.[user.id] || null, label: user.name })} />
                                )}
                            </div>
                        ))}

                        {users.length === 0 && (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                                <p className="text-gray-400">No users connected</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Invitation Code Section */}
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-4 shadow-xl">
                    <h3 className="text-lg font-semibold text-white mb-3">Room Code</h3>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-800/50 border border-gray-600 rounded-lg p-3">
                            <code className="text-blue-300 font-mono text-sm break-all">
                                {roomId || "Loading..."}
                            </code>
                        </div>
                        <button onClick={copyInviteCode} className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 group" title="Copy invitation code">
                            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Share this code with others to join the session
                    </p>
                </div>
            </div>

            {/* Zoomed Video Modal */}
            {zoomedStream && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-5xl bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700 aspect-video">
                        <button 
                            onClick={() => setZoomedStream(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <VideoStream stream={zoomedStream.stream} muted={zoomedStream.label === 'You'} />
                        <div className="absolute bottom-4 left-4 bg-black/60 px-4 py-2 rounded-lg text-white font-medium backdrop-blur">
                            {zoomedStream.label}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};