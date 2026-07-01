# Whiteboard Architecture — End-to-End Flow

## System Overview

```
 USER A (Drawer)                WebSocket Server              USER B (Viewer)
 ┌─────────────┐               ┌─────────────┐              ┌─────────────┐
 │  Frontend   │◄─────WS──────►│  WS Server  │◄────WS──────►│  Frontend  │
 │ (React/TSX) │               │  (Node.js)  │              │ (React/TSX) │
 │             │               │  Pub/Sub    │              │             │
 └─────────────┘               └─────────────┘              └─────────────┘
```

---

## Dual Canvas Architecture

```
┌──────────────────────────────────────┐
│  overlayRef  (TOP canvas)            │ ← User draws here (live preview)
│  - transparent background            │   Clears on every frame during drawing
│  - receives all pointer events       │   Cleared completely on pointerUp
├──────────────────────────────────────┤
│  canvasRef   (BOTTOM canvas)         │ ← Committed strokes live here
│  - dark background (#0b1020)         │   Permanent, never cleared mid-draw
│  - receives remote + finished strokes│   Source for localStorage auto-save
└──────────────────────────────────────┘
```

---

## Step-by-Step Flow

### STEP 1 — User Presses Mouse Down (`onPointerDown`)

```ts
function onPointerDown(e) {
    isDrawing.current = true;
    currentPath.current = [getPos(e, overlayRef.current)];  // start collecting
}
```

- `isDrawing` ref flipped to `true`
- First `{x, y}` point saved into `currentPath.current[]`
- Coordinates are **canvas-space** (1600×900), NOT screen pixels

**Nothing sent to server yet.**

---

### STEP 2 — User Moves Mouse (`onPointerMove`) — fires every frame

Two independent things happen in parallel:

#### 2A — Point Collection (no throttle)
```ts
if (isDrawing.current) {
    currentPath.current.push(pos);  // every single move event
}
```
Every `{x, y}` position is pushed into the array in memory. Cheap operation.

#### 2B — Local Live Preview (no throttle)
```ts
ctx.clearRect(0, 0, overlay.width, overlay.height);  // wipe previous frame
drawStroke(ctx, { points: currentPath.current, ... }); // redraw entire path
```
The **overlay canvas** is cleared and redrawn every frame so the user sees a smooth stroke in real time.

#### 2C — Cursor Broadcast (THROTTLED — max 1 per 50ms)
```ts
if (now - lastCursorSend.current > 50) {
    socket.send({ type: "whiteboard_cursor", x, y, username });
    lastCursorSend.current = now;
}
```
Only cursor position is sent to the server during movement. Throttled to prevent WebSocket congestion.

---

### STEP 3 — User Lifts Mouse (`onPointerUp`)

This is where everything comes together:

```ts
function onPointerUp() {
    // 1. Stop drawing
    isDrawing.current = false;

    // 2. Guard: discard tiny accidental taps
    if (currentPath.current.length < 2) return;

    // 3. Build the Stroke object
    const stroke = {
        points: currentPath.current,   // entire path array
        lineWidth,                     // brush size (1–20)
        tool,                          // "pen" or "eraser"
        author: username,              // "Harshit"
        ts: Date.now()                 // timestamp
    };

    // 4. Clear the overlay canvas (remove live preview)
    overlayCtx.clearRect(...);
    currentPath.current = [];

    // 5. Commit stroke to main canvas (local, permanent)
    drawStroke(mainCtx, stroke);

    // 6. Debounced auto-save to localStorage (1000ms delay)
    triggerAutoSave();

    // 7. Broadcast full stroke to WebSocket server
    socket.send(JSON.stringify({
        type: "whiteboard_stroke",
        roomId,
        stroke
    }));
}
```

---

### STEP 4 — WebSocket Server Receives & Broadcasts

```ts
// router.ts
whiteboard_stroke: (data, { userId, roomId, rooms, publisherClient }) => {
    publisherClient.publish(roomId, JSON.stringify({
        type: "whiteboard_stroke",
        stroke: data.stroke
    }));
}
```

The server does **zero processing** of the stroke data:
- Receives the `whiteboard_stroke` message from User A
- Publishes it to the **Redis Pub/Sub channel** for that `roomId`
- All subscribers (other users in the room) receive it instantly

---

### STEP 5 — Remote User Receives the Stroke

```ts
// In useEffect — socket message listener
if (data.type === "whiteboard_stroke") {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && data.stroke) {
        drawStroke(ctx, data.stroke);   // replay on main canvas
        triggerAutoSave();              // debounced localStorage save
        setAuthorColors(prev => ({
            ...prev,
            [data.stroke.author]: getUserColor(data.stroke.author)
        }));
    }
}
```

The remote user gets the **complete stroke object** and replays it directly onto their **main canvas** (`canvasRef`) — bypassing the overlay entirely.

---

### STEP 6 — Smooth Curve Rendering (`drawStroke`)

```ts
function drawStroke(ctx, stroke) {
    ctx.strokeStyle = getUserColor(stroke.author);  // unique color per user
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    // Midpoint smoothing — quadratic bezier curves
    for (let i = 1; i < stroke.points.length - 1; i++) {
        const midX = (stroke.points[i].x + stroke.points[i+1].x) / 2;
        const midY = (stroke.points[i].y + stroke.points[i+1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
    }

    ctx.lineTo(last.x, last.y);
    ctx.stroke();
}
```

Called in identical fashion for both local commit and remote replay — so the stroke looks **exactly the same** on all screens.

---

## Complete Data Flow Diagram

```
USER A
  │
  ├─ pointerDown ──────────────────────────────────► start collecting points
  │
  ├─ pointerMove (×100s) ─────────────────────────► push point to array
  │      │                                          ► redraw overlay (local only)
  │      └─ every 50ms ───────────────────────────► send cursor position via WS
  │
  └─ pointerUp ────────────────────────────────────► build Stroke object
         │                                          ► clear overlay canvas
         │                                          ► drawStroke on main canvas (local)
         │                                          ► triggerAutoSave() [debounced 1s]
         │
         └──── socket.send(whiteboard_stroke) ─────► WS Server
                                                          │
                                              publisherClient.publish(roomId)
                                                          │
                                                    Redis Pub/Sub
                                                          │
                                              ┌───────────┴───────────┐
                                           USER B                  USER C
                                              │                       │
                                        handleMessage           handleMessage
                                              │                       │
                                        drawStroke()            drawStroke()
                                        (main canvas)           (main canvas)
                                              │                       │
                                        triggerAutoSave()      triggerAutoSave()
```

---

## Remote Cursor Flow (Parallel)

```
USER A moves mouse
  └─ every 50ms ──► send { type: "whiteboard_cursor", x, y, username }
                          │
                    WS Server broadcasts to room
                          │
                    USER B receives
                          │
                    setRemoteCursors({ "UserA": { x, y, updated_at: now } })
                          │
                    Rendered as SVG cursor at:
                    left: (x / 1600) * 100%
                    top:  (y /  900) * 100%

Stale cursor cleanup:
  setInterval every 1500ms → remove cursors not updated in last 3000ms
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Dual canvas (overlay + main) | Clean separation of live preview vs committed strokes |
| Collect-then-send (not send-on-move) | 1 WS message per stroke instead of 100s |
| Canvas coords (1600×900) not screen coords | Strokes look identical across all screen sizes |
| Throttle cursor at 50ms | Reduce WS congestion while keeping cursor "live" feeling |
| Debounce localStorage save at 1000ms | Avoid expensive `toDataURL()` on every stroke |
| `quadraticCurveTo` midpoint smoothing | Natural handwriting feel when replaying points |
| Server does zero processing | Keeps server stateless; all rendering logic is client-side |


# Chat Conversation

Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

in this project for whiteboard we used throttling?

*Grep searched codebase*

*Grep searched codebase*

### Planner Response

Let me look at the exact throttling implementation in [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx):

*Viewed [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx) *

### Planner Response

Yes! Throttling **is** used in the whiteboard, but specifically and only for **cursor position broadcasting**. Here's a breakdown:

---

## Where Throttling is Used

In [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx#L117-L122), inside the `onPointerMove` handler:

```ts
// Throttled Network Request (Max 1 per 50ms)
if (now - lastCursorSend.current > 50) {
   socket?.send(JSON.stringify({ type: "whiteboard_cursor", roomId, x: pos.x, y: pos.y, username }));
   lastCursorSend.current = now;
}
```

### How it works:
- A `lastCursorSend` ref tracks the **timestamp of the last cursor WebSocket message** sent.
- On every pointer move, it checks if **50ms have passed** since the last send.
- If yes → sends the cursor position to the server.
- If no → **skips** the send (throttled).

This is a **manual timestamp-based throttle** (not using lodash.throttle, even though that package is installed).

---

## What is NOT throttled:
- **Stroke broadcasting** — sent once on `pointerUp` (not during drawing), so throttling isn't needed.
- **Canvas drawing** itself — updates locally every frame for smooth rendering.

---

## Summary Table

| Event | Throttled? | Frequency | Why |
|---|---|---|---|
| `whiteboard_cursor` send | ✅ Yes | Max 1 per 50ms | Prevent WebSocket congestion |
| `whiteboard_stroke` send | ❌ No | Once per stroke (on pointer up) | Already infrequent |
| Local canvas drawing | ❌ No | Every pointer move | Needs to be smooth |

### User Input

and we also used deboumcing in whiteboard for drawing?

*Grep searched codebase*

*Grep searched codebase*

*Grep searched codebase*

*Viewed [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx) *

### Planner Response

**No, debouncing is NOT used for drawing itself.** But there IS a debounce pattern used for **auto-saving**. Here's the full picture:

---

## What's Actually in the Whiteboard

### ✅ Debounce — used for `triggerAutoSave()` (NOT drawing)

```ts
// Line 46
const saveTimer = useRef<ReturnType<typeof setTimeout>>();

// Line 51–58
function triggerAutoSave() {
    clearTimeout(saveTimer.current);          // cancel previous timer
    saveTimer.current = setTimeout(() => {   // set new 1s delayed timer
        if (canvasRef.current) {
            localStorage.setItem(`whiteboard_${roomId}`, canvasRef.current.toDataURL());
        }
    }, 1000);  // 1 second debounce
}
```

This is a **classic manual debounce** — it delays saving to `localStorage` by **1 second** after the last stroke. If another stroke comes in before 1s, the timer resets. Called in two places:
- After `onPointerUp` (own stroke finished)
- After receiving a `whiteboard_stroke` from a remote user

---

### ✅ Throttle — used for `whiteboard_cursor` broadcast
Max 1 WebSocket send per **50ms** during pointer move.

---

### ❌ No debounce/throttle on drawing itself
- Local canvas drawing happens **every pointer move frame** — no delay, no throttle — intentionally for smooth real-time rendering.

---

## Summary

| Feature | Technique | Interval | Purpose |
|---|---|---|---|
| Cursor broadcast | **Throttle** | 50ms | Reduce WebSocket messages |
| Auto-save to localStorage | **Debounce** | 1000ms | Avoid saving on every stroke |
| Local canvas drawing | **None** | Every frame | Smooth UX |
| Stroke broadcast | **None** | Once on `pointerUp` | Already infrequent |

### User Input

how we are broadcasting the drawing made through curor movement?

*Viewed [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx) *

### Planner Response

Great question! The drawing is **NOT broadcast during cursor movement** — it uses a smart **collect-then-send** approach. Here's exactly how it works:

---

## The 3-Phase Drawing Broadcast Flow

### Phase 1 — `onPointerDown` → Start collecting points
```ts
// Line 99–108
function onPointerDown(e: any) {
    isDrawing.current = true;           // flag drawing started
    currentPath.current = [getPos(e, overlayRef.current)];  // collect first point
}
```
No broadcast yet. Just starts recording the path into `currentPath.current`.

---

### Phase 2 — `onPointerMove` → Collect points silently (draw locally only)
```ts
// Line 124–126
if (isDrawing.current) {
    currentPath.current.push(pos);   // keep accumulating points
}

// Line 132–135 — draw ONLY on overlay canvas (local preview)
ctx.clearRect(0, 0, overlay.width, overlay.height);
drawStroke(ctx, { points: currentPath.current, lineWidth, tool, author: username });
```
Every mouse move **accumulates points** into `currentPath.current` and re-renders on the **overlay canvas** (the top canvas) for the local user to see in real time. **Nothing is sent over WebSocket here** (only cursor position is throttled-sent).

---

### Phase 3 — `onPointerUp` → Send the ENTIRE stroke at once
```ts
// Line 138–169
function onPointerUp(e?: any) {
    const stroke: Stroke = { 
        points: currentPath.current,   // ALL collected points
        lineWidth, tool, 
        author: username, 
        ts: Date.now() 
    };

    // 1. Clear overlay (preview layer)
    overlayCtx.clearRect(...);

    // 2. Commit stroke to main canvas locally
    drawStroke(mainCtx, stroke);

    // 3. Trigger debounced auto-save
    triggerAutoSave();

    // 4. Broadcast the FULL stroke via WebSocket
    socket?.send(JSON.stringify({
        type: "whiteboard_stroke",
        roomId,
        stroke           // entire path array sent once
    }));
}
```

---

## How Remote Users Receive & Render It

```ts
// Line 178–186
if (data.type === "whiteboard_stroke") {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && data.stroke) {
        drawStroke(ctx, data.stroke);   // replay the full stroke
        triggerAutoSave();
    }
}
```
The remote user receives the **complete stroke object** and replays all the points at once using smooth `quadraticCurveTo` curves.

---

## Why This Design is Smart

```
Mouse Move  →  Local only (instant feedback, no network)
Mouse Up    →  Broadcast once (entire stroke as one WebSocket message)
```

| Approach | Network calls per stroke | Latency feel |
|---|---|---|
| **Send on every move** | ~100s of messages | Laggy & congested |
| **Send on pointer up** ✅ | **1 message** | Smooth locally, synced on release |

The dual-canvas architecture is key here:
- **`overlayRef`** (top) → live drawing preview, cleared after each stroke
- **`canvasRef`** (bottom) → committed strokes from all users, permanent

### User Input

so debouncing is used to send it on pub sub right? we are sending entire stroke at once when user stops or(onPointerUp)

*Viewed [Whiteboard.tsx](file:///c:/Users/Harshit/Desktop/RESUME%20PROJECTS/SYNC-CODE-main%20FINAL/apps/frontend/src/components/Whiteboard.tsx) *

### Planner Response

**No, that's a common misconception — debouncing has nothing to do with sending the stroke.** Let me clarify precisely:

---

## Stroke Sending → Direct, No Debounce

```ts
// onPointerUp — Line 162–169
triggerAutoSave();   // ← debounce is ONLY for this (localStorage)

socket?.send(JSON.stringify({   // ← DIRECT send, no debounce
    type: "whiteboard_stroke",
    roomId,
    stroke
}));
```

These are **two separate, independent things** happening on `onPointerUp`:

| Action | Technique | Purpose |
|---|---|---|
| `socket.send(stroke)` | **Nothing** — fires instantly | Broadcast to other users via WebSocket → Pub/Sub |
| `triggerAutoSave()` | **Debounce (1000ms)** | Save canvas to `localStorage` only |

---

## So What Triggers the Pub/Sub Send?

Simply **lifting the mouse/finger** (`onPointerUp`). No debounce, no delay — it fires **immediately**:

```
User lifts finger
    → onPointerUp fires
        → socket.send(full stroke)  [instant, direct]
        → triggerAutoSave()         [debounced 1s, for localStorage only]
```

---

## Why Debounce is NOT Needed Here

Debounce makes sense when an event fires **many times rapidly** and you want to wait for it to stop (e.g., typing, window resize). But `onPointerUp` fires **exactly once** per stroke — so there's nothing to debounce. The stroke is already the final, complete result.

> **In short:** The drawing broadcast uses the **collect-then-send** pattern (not debounce). Debounce in this file is exclusively a `localStorage` optimization.

### User Input

in stroke what we are actually sending? cursor positions?

### Planner Response

Yes, essentially **cursor positions** — but more precisely, **canvas-coordinate points**. Here's exactly what gets sent:

---

## The `Stroke` Object (Interface — Line 19–25)

```ts
interface Stroke {
    points: {x: number, y: number}[];  // ← array of canvas positions
    lineWidth: number;                  // ← brush size
    tool: string;                       // ← "pen" or "eraser"
    author: string;                     // ← username
    ts?: number;                        // ← timestamp
}
```

---

## What Goes Into `points[]`?

Points are **NOT raw screen coordinates** — they're **scaled canvas coordinates**, converted via `getPos()`:

```ts
// Line 78–97
function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;    // canvas is 1600px wide
    const scaleY = canvas.height / rect.height;  // canvas is 900px tall

    return {
        x: (clientX - rect.left) * scaleX,   // scaled X
        y: (clientY - rect.top) * scaleY,    // scaled Y
    };
}
```

So they're cursor positions **mapped to canvas space (1600×900)** — not screen pixels. This ensures the drawing looks the same regardless of each user's screen size.

---

## How `points[]` Gets Built

```
onPointerDown  →  currentPath.current = [first point]
onPointerMove  →  currentPath.current.push(nextPoint)  (every mouse move)
onPointerMove  →  currentPath.current.push(nextPoint)
onPointerMove  →  currentPath.current.push(nextPoint)
...
onPointerUp    →  send { points: currentPath.current, lineWidth, tool, author, ts }
```

---

## Example Stroke Payload Sent Over WebSocket

```json
{
  "type": "whiteboard_stroke",
  "roomId": "abc123",
  "stroke": {
    "points": [
      { "x": 120.5, "y": 340.2 },
      { "x": 125.1, "y": 345.8 },
      { "x": 131.0, "y": 352.3 }
      // ... hundreds of points
    ],
    "lineWidth": 3,
    "tool": "pen",
    "author": "Harshit",
    "ts": 1719823547000
  }
}
```

---

## How Remote Draws It Back (Smooth Curves)

The receiver doesn't just connect dots — it uses `quadraticCurveTo` for smooth curves:

```ts
// Line 68–72
for (let i = 1; i < stroke.points.length - 1; i++) {
    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
}
```

This makes the replayed stroke look **identical** to what the original user drew, even though it arrives all at once.

### User Input

so what stroke looks likes after ending?

### Planner Response

Here's a **concrete real-world example** of what a stroke looks like after a user draws a small curve and lifts their finger:

---

## Complete Stroke Object (after `onPointerUp`)

Imagine a user draws a small "C" shape on the whiteboard:

```json
{
  "type": "whiteboard_stroke",
  "roomId": "room-xyz",
  "stroke": {
    "points": [
      { "x": 400.0, "y": 200.0 },   ← pointerDown (start)
      { "x": 398.5, "y": 215.3 },   ← move
      { "x": 392.1, "y": 230.8 },   ← move
      { "x": 381.7, "y": 244.2 },   ← move
      { "x": 368.3, "y": 255.6 },   ← move
      { "x": 352.0, "y": 263.1 },   ← move
      { "x": 334.5, "y": 267.4 },   ← move
      { "x": 316.2, "y": 268.0 },   ← move
      { "x": 298.8, "y": 264.7 },   ← move
      { "x": 283.1, "y": 257.3 },   ← move
      { "x": 270.4, "y": 246.5 },   ← pointerUp (end)
    ],
    "lineWidth": 3,
    "tool": "pen",
    "author": "Harshit",
    "ts": 1719823547382
  }
}
```

---

## Visualized

```
Start (400, 200)
      •
       \
        •
         \
          •
           \  ← each dot = one point in points[]
            •
             \
              •————•————•————• End (270, 246)
```

Each `•` = one `{x, y}` object captured during `onPointerMove`.

---

## Key Facts About the Points Array

| Property | Detail |
|---|---|
| **Coordinate space** | Canvas pixels (1600×900), NOT screen pixels |
| **Density** | Depends on how fast user moves — fast = fewer points, slow = many points |
| **First point** | Added in `onPointerDown` |
| **Middle points** | Added every `onPointerMove` tick |
| **Last point** | Last `onPointerMove` before `onPointerUp` |
| **Min length** | Must be ≥ 2 points, else stroke is discarded (line 143) |

---

## Then How Remote Renders It

Instead of drawing jagged straight lines between points, it uses **midpoint smoothing**:

```
Between each pair of points → draw a quadratic curve through the midpoint
→ Result: buttery smooth curve that matches exactly what you drew
```

So even though it's just an **array of `{x,y}` positions**, when replayed with `quadraticCurveTo`, it looks like natural handwriting. 🎨

### User Input

the move part is storing points for every event or it also uses throttling?

### Planner Response

**Every single `onPointerMove` event** — no throttling on point collection. Look at the exact code:

---

## The `onPointerMove` Handler (Lines 110–136)

```ts
function onPointerMove(e: any) {
    if (overlayRef.current) {
        const pos = getPos(e, overlayRef.current);
        const now = Date.now();

        // ✅ THROTTLED (50ms) — cursor broadcast only
        if (now - lastCursorSend.current > 50) {
           socket?.send(JSON.stringify({ type: "whiteboard_cursor", ... }));
           lastCursorSend.current = now;
        }
        
        // ❌ NO THROTTLE — every single event
        if (isDrawing.current) {
            currentPath.current.push(pos);  // ← stores EVERY point
        }
    }

    // ❌ NO THROTTLE — redraws every event too
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawStroke(ctx, { points: currentPath.current, ... });
}
```

---

## Two Separate Things Inside `onPointerMove`

```
onPointerMove fires
    ├── cursor WebSocket send  →  THROTTLED (max 1 per 50ms)
    └── point collection       →  EVERY event, no throttle
        └── canvas redraw      →  EVERY event, no throttle
```

---

## Why is This Intentional?

| Operation | Throttled? | Reason |
|---|---|---|
| `socket.send(cursor)` | ✅ Yes (50ms) | Network is expensive |
| `currentPath.current.push(pos)` | ❌ No | More points = smoother final curve |
| Overlay canvas redraw | ❌ No | Must feel smooth while drawing |

The point collection is **cheap** — just pushing `{x, y}` to an array in memory. The **expensive** part (WebSocket send) is what gets throttled.

---

## The Tradeoff

More points collected → **smoother stroke** for remote users when replayed, but also **larger payload** sent on `onPointerUp`. It's a deliberate choice: sacrifice a bit of payload size for **drawing quality**.

### User Input

where is the origin on the canva?

### Planner Response

## Canvas Origin = **Top-Left Corner (0, 0)**

This is standard for every HTML `<canvas>` element:

```
(0,0) ──────────────────────── (1600, 0)
  │                                 │
  │                                 │
  │         Canvas (1600×900)       │
  │                                 │
  │                                 │
(0, 900) ────────────────── (1600, 900)
```

- **X** increases → going **right**
- **Y** increases → going **down** *(opposite to maths!)*

---

## How `getPos()` Maps Screen → Canvas Origin

```ts
function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect(); // canvas position on screen
    const scaleX = canvas.width / rect.width;   // 1600 / displayed width
    const scaleY = canvas.height / rect.height; // 900 / displayed height

    return {
        x: (clientX - rect.left) * scaleX,  // ← rect.left = screen X of canvas origin
        y: (clientY - rect.top) * scaleY,   // ← rect.top  = screen Y of canvas origin
    };
}
```

`rect.left` and `rect.top` are the **screen coordinates of the canvas's top-left corner**. Subtracting them gives you the position **relative to the canvas origin (0,0)**.

---

## Visual Example

```
Screen (browser window)
┌──────────────────────────────────┐
│  toolbar, padding, etc.          │
│   ┌─────────────────────────┐    │
│   │(0,0) ← canvas origin    │    │
│   │                         │    │  rect.left / rect.top
│   │    Canvas               │    │  tell us WHERE this corner is
│   │                         │    │
│   └─────────────────────────┘    │
└──────────────────────────────────┘

If user clicks at screen (850, 400)
and canvas top-left is at screen (250, 100):

canvas_x = (850 - 250) * scaleX = 600 * scaleX
canvas_y = (400 - 100) * scaleY = 300 * scaleY
```

This is why `rect.left`/`rect.top` subtraction is critical — without it, the drawing would be **offset** and misaligned for all users.

### User Input

now give me a step by step detailed flow explaining the whiteboard architecure from drawing on canvas to showing on the other participants in the room

*Edited relevant file*

### Planner Response

Here's the complete end-to-end whiteboard architecture:

---

## 6-Step Flow Summary

```
STEP 1  pointerDown   → start collecting, record first point
STEP 2  pointerMove   → collect every point + redraw overlay locally
                        └─ every 50ms → send cursor pos via WS (throttled)
STEP 3  pointerUp     → build Stroke, clear overlay, commit to main canvas
                        └─ send full stroke via WebSocket (one message)
STEP 4  WS Server     → zero processing, just publish to Redis Pub/Sub for roomId
STEP 5  Remote users  → receive stroke, call drawStroke() on their main canvas
STEP 6  Rendering     → quadraticCurveTo midpoint smoothing = identical result on all screens
```

---

## The Key Insight

The architecture splits concerns cleanly into **3 layers**:

| Layer | What | Where |
|---|---|---|
| **Live preview** | Overlay canvas, clears every frame | Local only, never sent |
| **Committed strokes** | Main canvas, permanent | Local + exact copy on all remotes |
| **Cursor ghosts** | React state → DOM elements | Throttled WS, auto-expire after 3s |

The full detailed document with data flow diagrams is in [whiteboard_architecture.md](file:///C:/Users/Harshit/.gemini/antigravity-ide/brain/d8ddecd8-50b9-4744-bebf-e6f21e338731/whiteboard_architecture.md).