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

    const myColor = getUserColor(username);
    const themeColor = "#22d3ee"; 

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
        if (!isDrawing.current || !overlayRef.current) return;
        
        currentPath.current.push(getPos(e, overlayRef.current));
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
                        if (data.stroke.author) {
                            setAuthorColors((prev) => ({ ...prev, [data.stroke.author]: getUserColor(data.stroke.author) }));
                        }
                    }
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

    const clearBoard = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if(ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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
            </div>
        </div>
    );
}
