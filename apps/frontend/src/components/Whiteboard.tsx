import { useEffect, useRef, useState } from "react";
import { Pencil, Eraser } from "lucide-react";

const USER_COLORS = [
    "#ff79c6", "#50fa7b", "#ffb86c", "#8be9fd",
    "#bd93f9", "#ff5555", "#f1fa8c", "#ff6e6e",
];
const TOOLS = { PEN: "pen", ERASER: "eraser" };

function getUserColor(username: string) {
    if (!username) return USER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

interface Stroke {
    points: {x: number, y: number}[];
    lineWidth: number;
    tool: string;
    author: string;
    ts?: number;
}

interface WhiteboardProps {
    roomId: string;
    username: string;
    socket: WebSocket | null;
}

export default function Whiteboard({ roomId, username, socket }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const currentPath = useRef<{x: number, y: number}[]>([]);

    const [tool, setTool] = useState(TOOLS.PEN);
    const [lineWidth, setLineWidth] = useState(3);
    const [authorColors, setAuthorColors] = useState<Record<string, string>>({});
    const [drawing, setDrawing] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number, y: number, updated_at: number }>>({});
    const lastCursorSend = useRef<number>(0);
    const saveTimer = useRef<ReturnType<typeof setTimeout>>();

    const myColor = getUserColor(username);
    const themeColor = "#22d3ee"; 

    function triggerAutoSave() {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            if (canvasRef.current) {
                localStorage.setItem(`whiteboard_${roomId}`, canvasRef.current.toDataURL());
            }
        }, 1000);
    }

    function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
        if (!stroke.points || stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.tool === TOOLS.ERASER ? "#0b1020" : getUserColor(stroke.author);
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
            const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
            const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
    }

    function getPos(e: React.PointerEvent | React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = 0;
        let clientY = 0;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    function onPointerDown(e: any) {
        e.preventDefault();
        e.stopPropagation();
        isDrawing.current = true;
        setDrawing(true);
        if(e.clientX) setCursorPos({ x: e.clientX, y: e.clientY });
        if(overlayRef.current) {
            currentPath.current = [getPos(e, overlayRef.current)];
        }
    }

    function onPointerMove(e: any) {
        e.preventDefault();
        e.stopPropagation();
        if(e.clientX) setCursorPos({ x: e.clientX, y: e.clientY });
        
        if (overlayRef.current) {
            const pos = getPos(e, overlayRef.current);
            const now = Date.now();
            // Throttled Network Request (Max 1 per 50ms)
            if (now - lastCursorSend.current > 50) {
               socket?.send(JSON.stringify({ type: "whiteboard_cursor", roomId, x: pos.x, y: pos.y, username }));
               lastCursorSend.current = now;
            }
            
            if (isDrawing.current) {
                currentPath.current.push(pos);
            }
        }
        
        if (!isDrawing.current || !overlayRef.current) return;
        const overlay = overlayRef.current;
        const ctx = overlay.getContext("2d");
        if (ctx) {
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            drawStroke(ctx, { points: currentPath.current, lineWidth, tool, author: username });
        }
    }

    function onPointerUp(e?: any) {
        e?.preventDefault();
        e?.stopPropagation();
        isDrawing.current = false;
        setDrawing(false);
        if (currentPath.current.length < 2 || !overlayRef.current) { 
            currentPath.current = []; 
            return; 
        }
        const stroke: Stroke = { points: currentPath.current, lineWidth, tool, author: username, ts: Date.now() };
        
        const overlayCtx = overlayRef.current.getContext("2d");
        if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        }
        currentPath.current = [];
        
        // Draw to main canvas locally
        const mainCtx = canvasRef.current?.getContext("2d");
        if(mainCtx) {
            drawStroke(mainCtx, stroke);
            setAuthorColors((prev) => ({ ...prev, [username]: myColor }));
        }

        triggerAutoSave();

        // Broadcast to WebSocket
        socket?.send(JSON.stringify({
            type: "whiteboard_stroke",
            roomId,
            stroke
        }));
    }

    useEffect(() => {
        if (!socket) return;
        
        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "whiteboard_stroke") {
                    const ctx = canvasRef.current?.getContext("2d");
                    if (ctx && data.stroke) {
                        drawStroke(ctx, data.stroke);
                        triggerAutoSave();
                        if (data.stroke.author) {
                            setAuthorColors((prev) => ({ ...prev, [data.stroke.author]: getUserColor(data.stroke.author) }));
                        }
                    }
                } else if (data.type === "whiteboard_cursor") {
                    setRemoteCursors(prev => ({
                        ...prev,
                        [data.username]: { x: data.x, y: data.y, updated_at: Date.now() }
                    }));
                } else if (data.type === "whiteboard_clear") {
                    const ctx = canvasRef.current?.getContext("2d");
                    if(ctx && canvasRef.current) {
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    }
                    setAuthorColors({});
                }
            } catch (err) {
                // Ignore parse errors safely
            }
        };

        socket.addEventListener("message", handleMessage);
        return () => socket.removeEventListener("message", handleMessage);
    }, [socket]);

    useEffect(() => {
        // Clean up stale cursors
        const interval = setInterval(() => {
            const now = Date.now();
            setRemoteCursors(prev => {
                const next = { ...prev };
                let changed = false;
                Object.keys(next).forEach(k => {
                    if (now - next[k].updated_at > 3000) {
                        delete next[k];
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 1500);

        // Load saved state from local storage on mount
        const savedData = localStorage.getItem(`whiteboard_${roomId}`);
        if (savedData && canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            const img = new Image();
            img.onload = () => {
                ctx?.drawImage(img, 0, 0);
            };
            img.src = savedData;
        }

        return () => clearInterval(interval);
    }, [roomId]);

    const clearBoard = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if(ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            localStorage.removeItem(`whiteboard_${roomId}`);
        }
        setAuthorColors({});
        
        socket?.send(JSON.stringify({
            type: "whiteboard_clear",
            roomId
        }));
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#11172a] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-wrap bg-[#1a2235]">
                <div className="flex items-center gap-1.5 mr-1">
                    <svg width="20" height="8" viewBox="0 0 20 8">
                        <path d="M0 4 Q10 0 20 4" stroke={myColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    </svg>
                </div>

                <div className="w-px h-4 bg-white/10" />

                {[TOOLS.PEN, TOOLS.ERASER].map((t) => (
                    <button
                        key={t}
                        onClick={() => setTool(t)}
                        className="text-xs px-3 py-1.5 rounded-md border transition-all cursor-pointer"
                        style={{
                            borderColor: tool === t ? themeColor : "rgba(255,255,255,0.15)",
                            background: tool === t ? `${themeColor}22` : "transparent",
                            color: tool === t ? themeColor : "#aaa",
                        }}
                    >
                        <span className="flex items-center gap-1">
                            {t === TOOLS.PEN ? <Pencil size={11} /> : <Eraser size={11} />}
                            {t === TOOLS.PEN ? "Pen" : "Eraser"}
                        </span>
                    </button>
                ))}

                <div className="flex items-center gap-2 ml-4">
                    <input
                        type="range" min={1} max={20} value={lineWidth}
                        onChange={(e) => setLineWidth(Number(e.target.value))}
                        style={{ width: 70, accentColor: themeColor }}
                    />
                    <span className="text-xs w-4" style={{ color: themeColor }}>{lineWidth}</span>
                </div>

                {Object.entries(authorColors).map(([author, color]) => (
                    <div key={author} className="flex items-center gap-1 ml-2">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
                        <span style={{ color: author === username ? color : "#aaa", fontSize: 9 }}>
                            {author === username ? "YOU" : author}
                        </span>
                    </div>
                ))}

                <button
                    onClick={clearBoard}
                    className="ml-auto text-xs px-3 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer transition-all"
                >
                    Clear Board
                </button>
            </div>

            <div className="relative flex-1 w-full h-full overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={1600} height={900}
                    className="absolute inset-0 w-full h-full"
                    style={{ background: "#0b1020" }}
                />
                <canvas
                    ref={overlayRef}
                    width={1600} height={900}
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                    className="absolute inset-0 w-full h-full"
                    style={{
                        cursor: tool === TOOLS.ERASER
                            ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Crect x='2' y='2' width='16' height='16' rx='2' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E\") 10 10, cell"
                            : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 0 24, crosshair"
                    }}
                />

                {drawing && tool === TOOLS.PEN && (
                    <div
                        className="fixed pointer-events-none z-[999] flex items-center gap-1"
                        style={{ left: cursorPos.x + 14, top: cursorPos.y + 14 }}
                    >
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: myColor, boxShadow: `0 0 4px ${myColor}` }} />
                        <span style={{
                            color: myColor,
                            fontSize: 10,
                            fontWeight: 700,
                        }}>
                            {username}
                        </span>
                    </div>
                )}

                {Object.entries(remoteCursors).map(([uname, pos]) => {
                    const color = getUserColor(uname);
                    return (
                        <div
                            key={uname}
                            className="absolute pointer-events-none z-[998] flex items-center gap-1 transition-all duration-75"
                            style={{ 
                                left: `${(pos.x / 1600) * 100}%`, 
                                top: `${(pos.y / 900) * 100}%` 
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="2" xmlns="http://www.w3.org/2000/svg" style={{ transform: "translate(-2px, -2px)" }}>
                                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                            </svg>
                            <span style={{ 
                                background: color, color: "white", padding: "2px 6px", 
                                borderRadius: "4px", fontSize: 10, fontWeight: 600, 
                                whiteSpace: "nowrap", opacity: 0.9,
                                transform: "translate(-4px, 12px)"
                            }}>
                                {uname}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
