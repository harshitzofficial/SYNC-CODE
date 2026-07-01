# 🎨 Whiteboard Architecture

## Table of Contents

1. System Overview
2. High-Level Architecture
3. Dual Canvas Design
4. Drawing Lifecycle
5. End-to-End Data Flow
6. WebSocket & Pub/Sub Flow
7. Remote Rendering
8. Cursor Synchronization
9. Stroke Structure
10. Eraser Implementation
11. Performance Optimizations
12. Complete Flow Diagram

---

# 1. System Overview

The whiteboard is a **real-time collaborative drawing system** where multiple users can draw simultaneously inside the same room.

The architecture is based on:

- React Frontend
- HTML Canvas
- WebSockets
- Redis Pub/Sub
- Dual Canvas Rendering

```
 USER A
    │
    ▼
Frontend (React)
    │
 WebSocket
    │
Node.js Server
    │
Redis Pub/Sub
    │
WebSocket
    │
Frontend
    ▼
 USER B
```

---

# 2. High-Level Architecture

```
 USER A (Drawer)                 WebSocket Server                 USER B (Viewer)

┌──────────────┐              ┌────────────────┐              ┌──────────────┐
│ React Client │◄────────────►│ Node.js Server │◄────────────►│ React Client │
│              │              │ Redis Pub/Sub  │              │              │
└──────────────┘              └────────────────┘              └──────────────┘
```

The server never renders anything.

Its only responsibility is:

- receive drawing events
- publish them to Redis
- broadcast them to everyone inside the room

---

# 3. Dual Canvas Architecture

Instead of using a single canvas, the application uses **two stacked canvases**.

```
┌────────────────────────────────────────────┐
│ overlayRef (Top Canvas)                    │
│--------------------------------------------│
│ • Transparent                              │
│ • Receives pointer events                  │
│ • Live drawing preview                     │
│ • Cleared every frame                      │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ canvasRef (Bottom Canvas)                  │
│--------------------------------------------│
│ • Permanent drawings                       │
│ • Remote strokes                           │
│ • Auto-save source                         │
│ • Never cleared while drawing              │
└────────────────────────────────────────────┘
```

### Why two canvases?

Using two canvases separates:

- temporary drawing preview
- permanent drawing

This prevents repainting the entire whiteboard every frame.

---

# 4. Drawing Lifecycle

Drawing happens in **three phases**.

---

## Phase 1 — Pointer Down

```
User presses mouse
        │
        ▼
onPointerDown()
```

Actions performed:

```ts
isDrawing.current = true;

currentPath.current = [
    getPos(e)
];
```

What happens?

- drawing starts
- first point stored
- nothing sent over network

---

## Phase 2 — Pointer Move

This event fires continuously while drawing.

Three independent operations happen.

---

### A. Collect Every Point

```ts
currentPath.current.push(pos);
```

Every pointer event stores:

```
[
 {x,y},
 {x,y},
 {x,y},
 {x,y},
 ...
]
```

No throttling is used here because:

- array push is cheap
- more points = smoother drawing

---

### B. Draw Local Preview

```ts
overlayCtx.clearRect(...);

drawStroke(...)
```

Only the **overlay canvas** is redrawn.

The main canvas is untouched.

---

### C. Broadcast Cursor Position

```ts
if(now-lastCursorSend>50){

 socket.send(cursor)

}
```

This **IS throttled**.

Maximum:

```
1 message every 50ms
```

Only cursor position is sent.

The stroke is **NOT** sent yet.

---

## Phase 3 — Pointer Up

This is where the complete drawing is finalized.

```
User releases mouse
        │
        ▼
onPointerUp()
```

Steps:

### Stop drawing

```ts
isDrawing.current=false;
```

---

### Create Stroke Object

```ts
const stroke={
    points,
    lineWidth,
    tool,
    author,
    ts
}
```

Example:

```json
{
  "points":[
      {"x":220,"y":130},
      {"x":224,"y":134},
      {"x":230,"y":141},
      {"x":239,"y":150}
  ],
  "lineWidth":3,
  "tool":"pen",
  "author":"Harshit",
  "ts":1719823547
}
```

---

### Clear Overlay Canvas

```
overlayCtx.clearRect(...)
```

Removes the temporary preview.

---

### Commit Stroke

```ts
drawStroke(mainCanvas,stroke)
```

Now the drawing becomes permanent.

---

### Trigger Debounced Auto Save

```ts
triggerAutoSave()
```

This is the only place where **debouncing** is used.

```
Delay = 1000ms
```

Purpose:

Avoid expensive

```
canvas.toDataURL()
```

after every stroke.

---

### Broadcast Stroke

```ts
socket.send({

type:"whiteboard_stroke",

stroke

})
```

Notice:

The entire stroke is sent **once**.

Not every mouse movement.

---

# 5. Stroke Structure

A stroke represents one complete drawing.

```ts
interface Stroke{

points:{x:number,y:number}[]

lineWidth:number

tool:string

author:string

timestamp:number

}
```

Example:

```
Pointer Down

↓

Point

↓

Point

↓

Point

↓

Point

↓

Pointer Up

↓

One Stroke
```

---

# 6. WebSocket & Redis Pub/Sub Flow

Once the stroke reaches the server:

```
Frontend

↓

WebSocket

↓

Node Server

↓

Redis Publish(roomId)

↓

Redis Subscribers

↓

Every participant
```

Server code:

```ts
publisherClient.publish(roomId,JSON.stringify({

type:"whiteboard_stroke",

stroke

}))
```

The server performs **zero drawing logic**.

It simply forwards messages.

---

# 7. Remote Rendering

Other users receive:

```json
{
"type":"whiteboard_stroke",
"stroke":{...}
}
```

Then:

```ts
drawStroke(ctx,data.stroke)
```

The exact same rendering function is reused.

Therefore:

- local drawing
- remote drawing

look identical.

---

# 8. Cursor Synchronization

Cursor movement is independent from drawing.

```
Pointer Move

↓

Throttle (50ms)

↓

Send Cursor

↓

Server

↓

Broadcast

↓

Remote Users

↓

Render SVG Cursor
```

Inactive cursors are automatically removed after:

```
3 seconds
```

---

# 9. Eraser Implementation

The eraser does **not** delete pixels.

Instead:

```ts
ctx.strokeStyle="#0b1020";
```

The stroke is drawn using the canvas background color.

Since everyone receives the same stroke,

all participants see the erase action instantly.

---

# 10. Performance Optimizations

## Throttling

Used for:

```
Cursor Broadcasting
```

```
50ms
```

Reason:

Reduce WebSocket traffic.

---

## Debouncing

Used for:

```
localStorage Auto Save
```

```
1000ms
```

Reason:

Avoid repeated

```
canvas.toDataURL()
```

---

## Collect-Then-Send Strategy

Instead of:

```
100+

WebSocket Messages

per stroke
```

the application sends:

```
1 WebSocket Message

per stroke
```

Benefits:

- less network traffic
- smoother drawing
- lower server load

---

# 11. Complete End-to-End Flow

```
User presses mouse
        │
        ▼
onPointerDown()
        │
        ▼
Store first point
        │
        ▼
Pointer Move
        │
        ├──────────────► Store every point
        │
        ├──────────────► Draw overlay preview
        │
        └──────────────► Broadcast cursor (50ms throttle)
        │
        ▼
Pointer Up
        │
        ▼
Create Stroke Object
        │
        ├────────► Draw on main canvas
        │
        ├────────► Debounced localStorage save
        │
        └────────► Send Stroke via WebSocket
                         │
                         ▼
                  Node.js Server
                         │
                         ▼
                 Redis Pub/Sub
                         │
                         ▼
               Other Participants
                         │
                         ▼
              drawStroke(mainCanvas)
                         │
                         ▼
          Whiteboard synchronized for everyone
```

---

# 12. Key Design Decisions

| Decision | Reason |
|-----------|--------|
| Dual Canvas | Separate preview and permanent drawing |
| Collect then Send | One network message per stroke |
| Canvas Coordinates | Consistent drawing across screen sizes |
| Throttled Cursor | Prevent WebSocket congestion |
| Debounced Auto Save | Reduce expensive `toDataURL()` calls |
| Quadratic Curves | Smooth handwriting |
| Stateless Server | Better scalability |
