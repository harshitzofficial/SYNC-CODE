import { useState, useEffect, useRef } from "react";
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import MonacoEditor from "@monaco-editor/react";
import { registerMonacoSnippets } from "../utils/monacoSnippets";
import { userAtom } from "../atoms/userAtom";
import { useRecoilState } from "recoil";
import { socketAtom } from "../atoms/socketAtom";
import { useNavigate, useParams } from "react-router-dom";
import { connectedUsersAtom } from "../atoms/connectedUsersAtom";
import { CodeEditorHeader } from "@/components/CodeEditorHeader";
import { UserList } from "@/components/UsersList";
import { ChatWindow } from "@/components/ChatWindow";
import type { ChatMessage } from "@/components/ChatWindow";
import Whiteboard from "@/components/Whiteboard";
import { CodeOutput } from "@/components/CodeOutput";
import { useWebRTC } from "@/hooks/useWebRTC";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { X } from "lucide-react";

// CodeEditor Component
export const CodeEditor = () => {
    const [code, setCode] = useState<any>("// Write your code here...");
    const editorRef = useRef<any>(null);
    const [language, setLanguage] = useState("javascript");
    const [output, setOutput] = useState<string[]>([]); // Output logs
    const [socket, setSocket] = useRecoilState<WebSocket | null>(socketAtom);
    const [isLoading, setIsLoading] = useState(false); // Loading state
    const [currentButtonState, setCurrentButtonState] = useState("Submit Code");
    const [input, setInput] = useState<string>(""); // Input for code
    const [user, setUser] = useRecoilState(userAtom);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'chat' | 'io'>('users');
    const [activeView, setActiveView] = useState<'editor' | 'whiteboard'>('editor');
    const [isChatZoomed, setIsChatZoomed] = useState(false);
    const navigate = useNavigate();

    const handleEditorWillMount = (monaco: any) => {
        registerMonacoSnippets(monaco);
    };

    // multipleyer state
    const [connectedUsers, setConnectedUsers] = useRecoilState<any[]>(connectedUsersAtom);
    const params = useParams();

    const { localStream, remoteStreams, toggleMic, toggleVideo, micEnabled, videoEnabled } = useWebRTC(socket, user.id, user.roomId, connectedUsers);

    useEffect(() => {
        if (!socket) {
            navigate('/' + params.roomId);
        } else {
            socket.send(
                JSON.stringify({
                    type: "requestToGetUsers",
                    roomId: user.roomId
                })
            );

            socket.send(
                JSON.stringify({
                    type: "requestForAllData",
                })
            )

            socket.onclose = () => {
                console.log('Socket closed');
                setUser({
                    id: "",
                    name: "",
                    roomId: ""
                })

                setSocket(null);
            }

            return () => {
                socket?.close();
            }
        }
    }, [socket, user.id]);

    useEffect(() => {
        if (!socket) {
            navigate('/' + params.roomId);
        } else {
            const handleMessage = (event: MessageEvent) => {
                const data = JSON.parse(event.data);

                if (data.type === 'users') {
                    toast.success("Users updated in room")
                    setConnectedUsers(data.users);
                }

                if (data.type === "code") {
                    // Do nothing, YJS handles code synchronization natively now
                }

                if (data.type === "output") {
                    setOutput((prevOutput) => [...prevOutput, data.message]);
                    toast.success("Code compiled successfully", {
                        description: "You can see the code output in output section",
                    })
                    handleButtonStatus("Submit Code", false);
                }
                if (data.type === "input") {
                    setInput(data.input);
                }

                if (data.type === "language") {
                    toast.success(`Language changed to ${data.language}`)
                    setLanguage(data.language);
                }

                if (data.type === "submitBtnStatus") {
                    setCurrentButtonState(data.value);
                    setIsLoading(data.isLoading);
                }

                if(data.type === "requestForAllData") {
                    socket.send(
                        JSON.stringify({
                            type: "allData",
                            code: code,
                            language: language,
                            input: input,
                            output: output,
                            currentButtonState,
                            isLoading,
                            userId: data.userId
                        })
                    )
                }

                if(data.type === "allData") {
                    setLanguage(data.language);
                    setCode(data.code);
                    setInput(data.input);
                    setCurrentButtonState(data.currentButtonState);
                    setIsLoading(data.isLoading);
                }

                if (data.type === "chat_ai_chunk") {
                    setChatMessages((prev) => {
                        const existingMsgIndex = prev.findIndex(m => m.id === data.messageId);
                        if (existingMsgIndex >= 0) {
                            const newMessages = [...prev];
                            newMessages[existingMsgIndex] = {
                                ...newMessages[existingMsgIndex],
                                text: newMessages[existingMsgIndex].text + data.text
                            };
                            return newMessages;
                        } else {
                            return [...prev, {
                                id: data.messageId,
                                text: data.text,
                                senderId: data.senderId,
                                senderName: data.senderName,
                                timestamp: data.timestamp,
                                isAi: true
                            }];
                        }
                    });
                }

                if (data.type === "chat_ai_error") {
                     setChatMessages((prev) => [
                        ...prev, {
                            id: uuidv4(),
                            text: `**Error**: ${data.error}`,
                            senderId: "ai-assistant",
                            senderName: "Gemini AI",
                            timestamp: Date.now(),
                            isAi: true
                        }
                     ]);
                }

                if (data.type === "chat_message") {
                    setChatMessages((prev) => [
                        ...prev,
                        {
                            id: uuidv4(),
                            text: data.text,
                            imageUrl: data.imageUrl,
                            senderId: data.senderId,
                            senderName: data.senderName,
                            timestamp: data.timestamp
                        }
                    ]);
                }
            };
            
            socket.addEventListener('message', handleMessage);
            return () => {
                socket.removeEventListener('message', handleMessage);
            };
        }
    }, [socket, code, input, language, currentButtonState, isLoading, connectedUsers, navigate, params.roomId]);

    const handleSubmit = async () => {
        console.log("clicked")
        handleButtonStatus("Submitting...", true);

        const submission = {
            code: editorRef.current ? editorRef.current.getValue() : code,
            language,
            roomId: user.roomId,
            input
        };

        console.log("submission here->")
        console.log(JSON.stringify(submission));

        console.log(submission);
        console.log(`${import.meta.env.VITE_PRIMARY_BACKEND_URL}`)
        const res = await fetch(`${import.meta.env.VITE_PRIMARY_BACKEND_URL}/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(submission),
        });

        handleButtonStatus("Compiling...", true);

        if (!res.ok) {
            setOutput((prevOutput) => [
                ...prevOutput,
                "Error submitting code. Please try again.",
            ]);
            handleButtonStatus("Submit Code", false);
        }

    }

    const handleInputChange = (e: any) => {
        setInput(e.target.value);
        socket?.send(
            JSON.stringify({
                type: "input",
                input: e.target.value,
                roomId: user.roomId
            })
        )
    }

    const handleLanguageChange = (value: any) => {
        setLanguage(value);
        socket?.send(
            JSON.stringify({
                type: "language",
                language: value,
                roomId: user.roomId
            })
        )
    }

    const handleButtonStatus = (value: any, isLoading: any) => {
        setCurrentButtonState(value);
        setIsLoading(isLoading);
        socket?.send(
            JSON.stringify({
                type: "submitBtnStatus",
                value: value,
                isLoading: isLoading,
                roomId: user.roomId
            })
        )
    }

    const handleCodeChange = (value: any) => {
        setCode(value);
        socket?.send(
            JSON.stringify({
                type: "code",
                code: value,
                roomId: user.roomId
            })
        )
    }

    const handleSendChatMessage = (text: string, imageUrl?: string) => {
        const newMessage: ChatMessage = {
            id: uuidv4(),
            text,
            imageUrl,
            senderId: user.id || "",
            senderName: user.name || "Local User",
            timestamp: Date.now()
        };

        // Instantly add it to our own view
        setChatMessages(prev => [...prev, newMessage]);

        // Send over socket to broadcast to others
        socket?.send(JSON.stringify({
            type: "chat_message",
            roomId: user.roomId,
            text: newMessage.text,
            imageUrl: newMessage.imageUrl,
            senderName: newMessage.senderName,
            timestamp: newMessage.timestamp
        }));
    };

    const handleAIAction = (ed: any, prompt: string) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel().getValueInRange(selection);
        
        if (!selectedText || selectedText.trim() === "") {
            toast.error("Please highlight some code first to use AI");
            return;
        }

        const messageId = uuidv4();
        
        // Broadcast the initial intent message
        const intentMsg = {
            id: uuidv4(),
            text: `*Asking AI:* ${prompt}`,
            senderId: user.id || "",
            senderName: user.name || "User",
            timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, intentMsg]);
        socket?.send(JSON.stringify({ ...intentMsg, type: "chat_message", roomId: user.roomId }));

        // Send the AI command directly to the websocket backend
        socket?.send(JSON.stringify({
            type: "ask_ai",
            messageId,
            roomId: user.roomId,
            prompt,
            code: selectedText,
            language
        }));
        
        // Open the chat tab automatically
        setActiveTab("chat");
        toast.info("Gemini AI is analyzing your code...");
    };

    const handleEditorDidMount = (editor: any, monaco: any) => {
        editorRef.current = editor;

        const doc = new Y.Doc();
        // Connect to our specialized Yjs WebSocket server on port 5001
        const provider = new WebsocketProvider(`ws://${window.location.hostname}:5001`, user.roomId, doc);
        const type = doc.getText('monaco');

        let debounceTimer: ReturnType<typeof setTimeout>;
        type.observe(() => {
            clearTimeout(debounceTimer);
            // 1.5s Debounce for saving data
            debounceTimer = setTimeout(() => {
                localStorage.setItem(`synccode_${user.roomId}`, type.toString());
                // Silently auto-save without showing a toast every time
            }, 1500);
        });

        const binding = new MonacoBinding(type, editorRef.current.getModel(), new Set([editorRef.current]), provider.awareness);

        provider.awareness.setLocalStateField('user', {
             name: user.name || 'Anonymous',
             color: '#' + Math.floor(Math.random()*16777215).toString(16)
        });

        // AI Pair Programmer Monaco Actions
        editor.addAction({
            id: "ai-explain-code",
            label: "🧠 AI: Explain this logic",
            contextMenuGroupId: "navigation",
            contextMenuOrder: 1,
            run: (ed: any) => handleAIAction(ed, "Explain this logic step-by-step.")
        });
        editor.addAction({
            id: "ai-find-bugs",
            label: "🐛 AI: Find Bugs",
            contextMenuGroupId: "navigation",
            contextMenuOrder: 2,
            run: (ed: any) => handleAIAction(ed, "Find bugs or security vulnerabilities in this code.")
        });
        editor.addAction({
            id: "ai-optimize-code",
            label: "⚡ AI: Optimize Code",
            contextMenuGroupId: "navigation",
            contextMenuOrder: 3,
            run: (ed: any) => handleAIAction(ed, "Optimize this code for performance and readability.")
        });
    }

    return (
        <div className="w-full h-full min-h-screen  min-w-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
            <div className="container mx-auto p-4 max-w-7xl">
                <CodeEditorHeader
                    language={language}
                    onLanguageChange={handleLanguageChange}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    currentButtonState={currentButtonState}
                    activeView={activeView}
                    onViewChange={setActiveView}
                />

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
                    {/* Code Editor / Whiteboard - Takes 75% space on desktop */}
                    <div className="xl:col-span-3 order-2 xl:order-1 h-full min-h-0">
                        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden shadow-xl h-full">
                            {activeView === 'editor' ? (
                                <div className="flex flex-grow h-full py-4">
                                    <MonacoEditor
                                    options={{
                                        smoothScrolling: true,
                                        fastScrollSensitivity: 1,
                                        scrollBeyondLastLine: false,
                                        minimap: { enabled: false },
                                        suggestOnTriggerCharacters: true,
                                        quickSuggestions: true,
                                        wordBasedSuggestions: "currentDocument"
                                    }}
                                    beforeMount={handleEditorWillMount}
                                    onMount={handleEditorDidMount}
                                    language={language}
                                    theme="vs-dark"
                                    height="100%"
                                />
                                </div>
                            ) : (
                                <Whiteboard roomId={user.roomId} username={user.name || "User"} socket={socket} />
                            )}
                        </div>
                    </div>

                    {/* Unified Right Sidebar: Users, Chat, I/O */}
                    <div className="xl:col-span-1 order-1 xl:order-2 h-full min-h-0 flex flex-col gap-4">
                        {/* Tabs Navigation */}
                        <div className="flex bg-gray-900/60 p-1 rounded-lg shrink-0 shadow-lg">
                            <button 
                                onClick={() => setActiveTab('users')} 
                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                Users & Info
                            </button>
                            <button 
                                onClick={() => setActiveTab('chat')} 
                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                Group Chat
                            </button>
                            <button 
                                onClick={() => setActiveTab('io')} 
                                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === 'io' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                I/O Output
                            </button>
                        </div>

                        {/* Tab Contents - Using hidden class to maintain state across switches */}
                        <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-10 ${activeTab === 'users' ? 'flex flex-col gap-6' : 'hidden'}`}>
                            <UserList 
                                users={connectedUsers} 
                                roomId={user.roomId} 
                                localUserId={user.id}
                                localUserName={user.name}
                                localStream={localStream}
                                remoteStreams={remoteStreams}
                                micEnabled={micEnabled}
                                videoEnabled={videoEnabled}
                                toggleMic={toggleMic}
                                toggleVideo={toggleVideo}
                            />
                        </div>

                        <div 
                            className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'flex flex-col' : 'hidden'} group relative`}
                            onDoubleClick={() => setIsChatZoomed(true)}
                        >
                            {/* Make chat window span full height properly */}
                            <div className="h-full">
                                <div className="absolute top-2 right-2 bg-black/60 rounded px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    Double-click to Zoom
                                </div>
                                <ChatWindow 
                                    messages={chatMessages} 
                                    localUserId={user.id || ""} 
                                    onSendMessage={handleSendChatMessage} 
                                />
                            </div>
                        </div>

                        <div className={`flex-1 min-h-0 ${activeTab === 'io' ? 'block' : 'hidden'}`}>
                            <CodeOutput
                                output={output}
                                onClear={() => setOutput([])}
                                input={input}
                                onInputChange={handleInputChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoomed Chat Modal */}
            {isChatZoomed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-5xl h-[85vh]">
                        <button 
                            onClick={() => setIsChatZoomed(false)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <ChatWindow 
                            messages={chatMessages} 
                            localUserId={user.id || ""} 
                            onSendMessage={handleSendChatMessage} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
}