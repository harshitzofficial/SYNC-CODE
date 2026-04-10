import { Send, ImagePlus, X, Bot } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    imageUrl?: string;
    isAi?: boolean;
}

interface ChatWindowProps {
    messages: ChatMessage[];
    localUserId: string;
    onSendMessage: (text: string, imageUrl?: string) => void;
}

export const ChatWindow = ({ messages, localUserId, onSendMessage }: ChatWindowProps) => {
    const [inputValue, setInputValue] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto scroll to bottom when new messages arrive
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_DIMENSION = 800; // Resize to ensure websocket payload stays small
                let width = img.width;
                let height = img.height;

                if (width > height && width > MAX_DIMENSION) {
                    height *= MAX_DIMENSION / width;
                    width = MAX_DIMENSION;
                } else if (height > MAX_DIMENSION) {
                    width *= MAX_DIMENSION / height;
                    height = MAX_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                // Compress highly for WebSocket payload
                const base64 = canvas.toDataURL("image/jpeg", 0.6); 
                setSelectedImage(base64);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (inputValue.trim() || selectedImage) {
            onSendMessage(inputValue.trim(), selectedImage || undefined);
            setInputValue("");
            setSelectedImage(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
            {/* Header */}
            <div className="p-3 bg-gray-900/50 border-b border-white/10 shrink-0">
                <h3 className="text-white font-semibold text-sm">Group Chat</h3>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        No messages yet. Say hi!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isLocal = msg.senderId === localUserId;
                        const isAi = msg.isAi || msg.senderId === "ai-assistant";
                        const alignmentClass = isLocal ? "ml-auto items-end" : "mr-auto items-start";
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col max-w-[90%] ${alignmentClass}`}
                            >
                                <span className="text-[10px] text-gray-400 mb-1 ml-1 flex items-center gap-1">
                                    {isAi && <Bot size={12} className="text-purple-400" />}
                                    {isLocal ? "You" : msg.senderName} • {formatTime(msg.timestamp)}
                                </span>
                                <div
                                    className={`px-3 py-2 rounded-xl text-sm break-words shadow-sm flex flex-col gap-2 ${
                                        isLocal
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : isAi
                                                ? "bg-purple-900/40 text-indigo-50 rounded-bl-none border border-purple-500/30"
                                                : "bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600"
                                    }`}
                                >
                                    {msg.imageUrl && (
                                        <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                                            <img src={msg.imageUrl} alt="attached" className="max-w-full h-auto rounded-md max-h-48 object-contain cursor-pointer" />
                                        </a>
                                    )}
                                    {msg.text && (
                                        isAi ? (
                                            <ReactMarkdown 
                                                components={{
                                                    code({node, inline, className, children, ...props}: any) {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return !inline && match ? (
                                                           <pre className="bg-black/60 p-3 rounded-lg border border-purple-500/30 overflow-x-auto mt-2 mb-2 text-[11px] font-mono text-purple-200">
                                                                <code className={className} {...props}>
                                                                    {children}
                                                                </code>
                                                           </pre>
                                                        ) : (
                                                           <code className="bg-black/40 px-1 py-0.5 rounded text-purple-300 font-mono text-xs" {...props}>
                                                                {children}
                                                           </code>
                                                        )
                                                    },
                                                    p({children}) { return <p className="mb-2 last:mb-0 leading-relaxed text-indigo-100/90">{children}</p> },
                                                    a({children, href}) { return <a href={href} className="text-blue-400 hover:text-blue-300 hover:underline">{children}</a> },
                                                    ul({children}) { return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul> },
                                                    ol({children}) { return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol> },
                                                    strong({children}) { return <strong className="font-semibold text-white">{children}</strong> }
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        ) : (
                                            <span>{msg.text}</span>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-gray-900/50 border-t border-white/10 shrink-0 flex flex-col gap-2">
                {selectedImage && (
                    <div className="relative self-start mt-1">
                        <div className="relative rounded-lg overflow-hidden border border-gray-600 bg-gray-800 flex items-center justify-center p-1" style={{ maxWidth: "150px", maxHeight: "150px" }}>
                            <img src={selectedImage} alt="Preview" className="max-w-full max-h-32 object-contain" />
                            <button 
                                type="button"
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}
                
                <form onSubmit={handleSend} className="flex items-center gap-2 w-full min-w-0">
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageSelect} />
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    >
                        <ImagePlus size={20} />
                    </button>
                    
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1 min-w-0 w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() && !selectedImage}
                        className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};
