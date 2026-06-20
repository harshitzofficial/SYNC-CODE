# SYNC-CODE

SYNC-CODE is a real-time collaborative coding platform featuring a multi-language code editor, interactive whiteboard, WebRTC-based audio/video chat, and integrated AI pair programming.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
  - [High-Level Service Topology](#high-level-service-topology)
  - [Code Execution Pipeline](#code-execution-pipeline)
  - [Dual WebSocket Strategy](#dual-websocket-strategy)
  - [Redis Architecture](#redis-architecture)
- [Monorepo Structure](#monorepo-structure)
- [Services](#services)
  - [Frontend](#frontend-appsfrontend)
  - [Express Server](#express-server-appsexpress-server)
  - [WebSocket Server](#websocket-server-appswebsocket-server)
  - [Worker](#worker-appsworker)
- [Real-Time Collaboration Features](#real-time-collaboration-features)
  - [CRDT-Based Code Sync](#crdt-based-code-sync)
  - [WebRTC Audio/Video](#webrtc-audiovideo)
  - [Collaborative Whiteboard](#collaborative-whiteboard)
  - [Chat & AI Integration](#chat--ai-integration)
- [Infrastructure & Deployment](#infrastructure--deployment)
  - [Docker Configuration](#docker-configuration)
  - [AWS Deployment Topology](#aws-deployment-topology)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Supported Languages](#supported-languages)
- [Security Model](#security-model)
- [Glossary](#glossary)

---

## Features

- **Real-time collaborative code editing** using Yjs CRDTs and Monaco Editor
- **Multi-language code execution** (JavaScript, Python, C++, Go) in Docker sandboxes
- **WebRTC mesh audio/video** calling with Perfect Negotiation
- **Collaborative whiteboard** with dual-canvas architecture and remote cursor tracking
- **AI Pair Programmer** powered by Google Gemini (`gemini-2.5-flash-lite`) with streaming responses
- **Integrated chat** with image sharing and Markdown rendering
- **Distributed presence** tracking via Redis Hashes
- **Horizontally scalable** backend via Redis Pub/Sub
- **Session-protected routing** with Recoil-based global state

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, TypeScript, Monaco Editor, Yjs, y-monaco, Recoil, Tailwind CSS, Framer Motion, shadcn/ui, Radix UI |
| **Signaling Server** | Node.js, TypeScript, `ws`, y-websocket, Google Generative AI SDK |
| **API Server** | Node.js, Express.js, TypeScript |
| **Worker** | Node.js, TypeScript, Docker CLI (`child_process`) |
| **Message Broker** | Redis (List, Pub/Sub, Hash) |
| **Monorepo Tooling** | Turborepo, npm workspaces, Prettier |
| **Containerization** | Docker (multi-stage builds) |
| **Deployment** | Vercel (Frontend), AWS ECS (API + Worker), AWS EC2 (WebSocket Server) |

---

## Architecture Overview

### High-Level Service Topology

The system is composed of four independent services communicating via HTTP, WebSockets, and Redis.

```mermaid
graph TD
    subgraph "Client"
        FE["apps/frontend (React/Vite)"]
    end

    subgraph "API Layer"
        EX["apps/express-server (Port 3000)"]
    end

    subgraph "Real-Time Layer"
        WS["apps/websocket-server (Port 5000 - Signaling)"]
        YJS["y-websocket (Port 5001 - CRDT Sync)"]
    end

    subgraph "Execution Layer"
        WK["apps/worker (Background)"]
    end

    subgraph "Redis Infrastructure"
        RL[("List: 'problems'")]
        RP[("Pub/Sub: roomId")]
        RH[("Hash: room:roomId:users")]
    end

    FE -- "POST /submit" --> EX
    FE -- "WebSocket Signaling" --> WS
    FE -- "CRDT Binary Sync" --> YJS

    EX -- "lPush" --> RL
    RL -- "brPop" --> WK
    WK -- "publish result" --> RP
    RP -- "subscribe" --> WS
    WS -- "ws.send(output)" --> FE
    WS -- "hSet / hGetAll" --> RH
```

---

### Code Execution Pipeline

The most critical data flow is the lifecycle of a code submission — from user action to sandboxed execution and back.

```mermaid
sequenceDiagram
    participant FE as "CodeEditor.tsx"
    participant EX as "express-server"
    participant RD as "Redis (List)"
    participant WK as "worker (Docker)"
    participant PS as "Redis (Pub/Sub)"
    participant WS as "websocket-server"

    FE->>EX: POST /submit (code, language, roomId, input)
    EX->>RD: lPush("problems", JSON payload)
    RD-->>WK: brPop("problems") [blocking]
    WK->>WK: Write files to /tmp/user-{timestamp}/
    WK->>WK: docker run --network none --memory=512m --cpus=0.5
    WK->>PS: publish(roomId, stdout/stderr)
    PS-->>WS: message event
    WS->>FE: ws.send({ type: "output", message })
```

**Step-by-step:**

1. **Submission** — `CodeEditor.tsx` sends `POST /submit` with `{ code, language, roomId, input }`.
2. **ID Generation** — Express generates `submissionId = "submission-" + Date.now() + "-" + roomId`.
3. **Queuing** — Express calls `redisClient.lPush("problems", JSON.stringify(payload))`.
4. **Consumption** — Worker blocks on `client.brPop("problems", 0)` until a job arrives.
5. **Staging** — Worker writes `userCode.<ext>` and `input.txt` to a temp directory.
6. **Execution** — Worker spawns a Docker container with a 20-second timeout.
7. **Result** — Worker publishes `stdout`/`stderr` to Redis channel `roomId`.
8. **Relay** — WebSocket server receives the Pub/Sub message and calls `ws.send()` to all clients in the room.

---

### Dual WebSocket Strategy

SYNC-CODE separates real-time traffic across two WebSocket connections:

| Port | Purpose | Technology | Handles |
|---|---|---|---|
| **5000** | Signaling | Custom `ws` server | Room management, WebRTC offers/answers/ICE, chat, whiteboard strokes, execution output, AI streaming |
| **5001** | CRDT Sync | `y-websocket` | Binary Yjs protocol for conflict-free code editor synchronization |

This separation ensures that heavy binary CRDT traffic does not interfere with low-latency application signaling.

---

### Redis Architecture

Redis serves three distinct roles as the central nervous system of the backend:

```mermaid
graph LR
    subgraph "Producer"
        EX["express-server\nlPush('problems')"]
    end
    subgraph "Consumer"
        WK["worker\nbrPop('problems')"]
    end
    subgraph "Broadcaster"
        WK2["worker\npublish(roomId, result)"]
        WS["websocket-server\nsubscribe(roomId)"]
    end
    subgraph "Presence Store"
        WS2["websocket-server\nhSet / hGetAll\nroom:roomId:users"]
    end

    EX --> RL[("List: 'problems'")]
    RL --> WK
    WK2 --> RP[("Pub/Sub: roomId")]
    RP --> WS
    WS2 --> RH[("Hash: room:roomId:users")]
```

| Role | Redis Primitive | Key | Used By |
|---|---|---|---|
| **Job Queue** | `List` | `problems` | Express (`lPush`), Worker (`brPop`) |
| **Message Bus** | `Pub/Sub` | `{roomId}` | Worker (`publish`), WebSocket Server (`subscribe`) |
| **Presence Store** | `Hash` | `room:{roomId}:users` | WebSocket Server (`hSet`, `hGetAll`) |

**First-In-Subscribes Optimization:** The WebSocket server only calls `pubSubClient.subscribe(roomId)` when the first user joins a room on that instance (`rooms[roomId].length === 1`). All subsequent users in the same room share the single subscription.

---

## Monorepo Structure

The project is managed as a **Turborepo** monorepo with **npm workspaces**.

```
SYNC-CODE/
├── apps/
│   ├── frontend/          # React/Vite SPA
│   ├── express-server/    # REST API (code submission)
│   ├── websocket-server/  # Signaling + CRDT sync server
│   └── worker/            # Docker-based code execution engine
├── packages/              # Shared configs and utilities
├── package.json           # Root workspace definition
└── turbo.json             # Turborepo task pipeline
```

### Turborepo Task Pipeline

Defined in `turbo.json`:

| Task | Behavior | Cache |
|---|---|---|
| `build` | Compiles TypeScript; outputs to `dist/**` | Yes |
| `check-types` | TypeScript validation; respects dependency order (`^check-types`) | Yes |
| `dev` | Starts all services in watch mode | No (persistent) |

### Root Scripts

```bash
npm run build    # turbo build — build all apps
npm run dev      # turbo dev — start all apps in dev mode
npm run lint     # turbo lint — lint entire monorepo
npm run format   # prettier --write "**/*.{ts,tsx,md}"
```

**Requirements:** Node.js >= 18, npm >= 10.8.1

---

## Services

### Frontend (`apps/frontend`)

The primary user interface — a high-performance collaborative IDE built with React and Vite.

**Key Dependencies:**

| Package | Purpose |
|---|---|
| `@monaco-editor/react` | VS Code-grade code editor |
| `yjs` + `y-monaco` + `y-websocket` | CRDT-based real-time text sync |
| `recoil` | Global state management |
| `react-router-dom` | Client-side routing |
| `tailwindcss` + `framer-motion` | Styling and animations |
| `@radix-ui/*` + `class-variance-authority` | Accessible UI primitives (shadcn/ui) |

**Routing:**

| Route | Component | Description |
|---|---|---|
| `/` | `Register` | Landing page — create a new room |
| `/:roomId` | `Register` | Join an existing room via invite link |
| `/code/:roomId` | `CodeEditor` (via `ProtectedRouter`) | Main collaborative workspace |

**Global State (Recoil Atoms):**

| Atom | Type | Purpose |
|---|---|---|
| `userAtom` | `{ id, name, roomId }` | Current user identity and room assignment |
| `socketAtom` | `WebSocket \| null` | Active signaling WebSocket instance |
| `connectedUsersAtom` | `User[]` | List of users currently in the room |

**Session Flow:**

```mermaid
graph TD
    A["User visits /"] --> B["Register.tsx"]
    B --> C["generateId() if no userId"]
    C --> D["initializeSocket(roomId, id, name)"]
    D --> E{"Server responds with roomId"}
    E --> F["Update userAtom"]
    F --> G["navigate('/code/:roomId')"]
    G --> H{"ProtectedRouter checks userAtom"}
    H -- "Valid" --> I["CodeEditor.tsx"]
    H -- "Invalid" --> B
```

---

### Express Server (`apps/express-server`)

A stateless REST API that acts as the producer in the code execution pipeline.

**Endpoint:**

```
POST /submit
Content-Type: application/json

{
  "code": "console.log('hello')",
  "language": "js",
  "roomId": "abc123",
  "input": ""
}
```

**Response:**
- `200 OK` — `"Submission received and stored"`
- `500 Internal Server Error` — `"Failed to store submission"`

**Configuration:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listen port |
| `REDIS_URL` | — | Redis connection string |

**Middleware:** `express.json()`, `cors()`  
**Binding:** `0.0.0.0` (accessible internally and externally)

---

### WebSocket Server (`apps/websocket-server`)

The real-time backbone of SYNC-CODE. Manages room lifecycle, message routing, Redis Pub/Sub relay, and AI streaming.

**Ports:**
- `5000` — Custom signaling server (`ws`)
- `5001` — Yjs CRDT sync server (`y-websocket` / `setupWSConnection`)

**Connection Lifecycle:**

```mermaid
sequenceDiagram
    participant C as "Client"
    participant WS as "WebSocket Server"
    participant R as "Redis"

    C->>WS: "Upgrade (query: roomId, id, name)"
    WS->>WS: "Check rooms[roomId]"
    alt "New Room"
        WS->>C: "{ type: 'roomId', isNewRoom: true }"
    else "Existing Room"
        WS->>C: "{ type: 'roomId', isNewRoom: false }"
    end
    WS->>R: "hSet('room:roomId:users', userId, name)"
    WS->>R: "publish(roomId, { type: 'broadcast', data: { type: 'users' } })"
    alt "First user in room on this instance"
        WS->>R: "pubSubClient.subscribe(roomId)"
    end
    WS->>C: "Broadcast updated user list"
```

**Message Types (handled by `requestRouter`):**

| Type | Delivery | Description |
|---|---|---|
| `requestToGetUsers` | Broadcast | Fetch all active users from Redis Hash |
| `requestForAllData` | Direct | New joiner requests full editor state from a peer |
| `allData` | Direct | Response with full environment snapshot |
| `code` / `input` / `language` | Broadcast | Sync editor content, stdin, and language selection |
| `submitBtnStatus` | Broadcast | Sync "Run" button loading state across all users |
| `cursorPosition` | Broadcast | Real-time remote cursor tracking in editor |
| `webrtc_offer` / `webrtc_answer` / `webrtc_ice_candidate` | Direct | WebRTC SDP and ICE relay for P2P audio/video |
| `chat_message` | Broadcast | Text and image messages in chat panel |
| `whiteboard_stroke` / `whiteboard_clear` | Broadcast | Canvas drawing paths and clear events |
| `whiteboard_cursor` | Broadcast | Remote mouse positions on whiteboard |
| `ask_ai` | Streaming | Triggers Gemini AI streaming response |

**Environment Variables:**

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection string |
| `GEMINI_API_KEY` | Google Generative AI API key |

---

### Worker (`apps/worker`)

A background service that consumes code execution jobs from Redis and runs them in ephemeral Docker containers.

**Execution Lifecycle:**

```mermaid
stateDiagram-v2
    [*] --> Idle: main() starts
    Idle --> Fetching: brPop("problems", 0)
    Fetching --> Staging: JSON.parse(job)
    Staging --> Executing: Write files to /tmp/user-{timestamp}/
    state Executing {
        direction LR
        DockerRun --> WaitTimeout: exec() with 20s timeout
    }
    Executing --> Publishing: Process exits or times out
    Publishing --> Cleanup: pubClient.publish(roomId, result)
    Cleanup --> Idle: fs.rm(codeDir, recursive)
```

**Supported Languages & Docker Images:**

| Language | Docker Image | Execution |
|---|---|---|
| JavaScript | `node:18-alpine` | `node userCode.js < input.txt` |
| Python | `python:3.9-alpine` | `python userCode.py < input.txt` |
| C++ | `gcc:latest` | `sh -c "g++ userCode.cpp -o a.out && ./a.out < input.txt"` |
| Go | `golang:1.20-alpine` | `sh -c "go run userCode.go < input.txt"` |

**Security Constraints per Execution Container:**

| Constraint | Value | Purpose |
|---|---|---|
| `--network none` | Disabled | Prevent data exfiltration / external access |
| `--memory` | `512m` | Prevent OOM attacks on host |
| `--cpus` | `0.5` | Prevent infinite loops from consuming host CPU |
| `--rm` | Auto-remove | Clean up container filesystem after execution |
| `timeout` | `20000ms` | Kill process if it exceeds 20 seconds |

**Environment Variables:**

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection string |

---

## Real-Time Collaboration Features

### CRDT-Based Code Sync

When the Monaco editor mounts (`handleEditorDidMount`):

1. A new `Y.Doc` is created to hold shared document state.
2. A `WebsocketProvider` connects to the Yjs sync server (port 5001) using `roomId` as the namespace.
3. `MonacoBinding` bridges the `Y.Text` shared type to the Monaco editor instance, enabling conflict-free multi-user editing with remote cursor visualization.

**State Synchronization Layers:**

| Layer | Mechanism | Manages |
|---|---|---|
| Document Content | Yjs CRDT | Code text, remote cursors |
| Environment State | WebSocket JSON (port 5000) | Language, input/output, button status, user presence |
| Ephemeral UI | React state / Recoil | Active tab, view mode (editor vs. whiteboard) |

**"Request For All Data" Pattern** — When a new user joins, they send `requestForAllData`. An existing peer responds with an `allData` payload containing the current `language`, `input`, `output`, and `isLoading` states, ensuring the new user is immediately in sync.

**Local Persistence** — Code and input are saved to `localStorage` on state change to prevent data loss on accidental page refresh.

---

### WebRTC Audio/Video

Implemented in the `useWebRTC` hook with a **mesh topology** — every user maintains a direct `RTCPeerConnection` with every other user.

```mermaid
sequenceDiagram
    participant U1 as "User A (Impolite)"
    participant WS as "WebSocket Server"
    participant U2 as "User B (Polite)"

    U1->>U1: createPeerConnection(targetUserId)
    U1->>WS: send({ type: 'webrtc_offer', offer })
    WS->>U2: forward({ type: 'webrtc_offer', senderId })
    U2->>U2: setRemoteDescription(offer)
    U2->>WS: send({ type: 'webrtc_answer', answer })
    WS->>U1: forward({ type: 'webrtc_answer' })
    U1->>U1: setRemoteDescription(answer)
    Note over U1, U2: ICE Candidate Exchange
    U1->>WS: send({ type: 'webrtc_ice_candidate', candidate })
    WS->>U2: forward(candidate)
    U2->>U2: addIceCandidate(candidate)
```

- **Perfect Negotiation** — Glare (simultaneous offers) is resolved by assigning a "polite" role to the peer with the lexicographically higher `userId`. The polite peer rolls back its own offer on collision.
- **ICE** — Uses Google public STUN servers for NAT traversal.
- **Track Management** — When `localStream` changes (camera/mic toggle), all active peer connections are updated via `pc.addTrack` / `pc.removeTrack`.

---

### Collaborative Whiteboard

A shared drawing surface using a **dual-canvas architecture**:

| Canvas | Role |
|---|---|
| `canvasRef` (Main) | Holds permanent, committed drawing state shared by all users |
| `overlayRef` (Overlay) | Renders the active local stroke in real-time before committing |

- **Stroke Broadcasting** — On `pointerUp`, the `Stroke` object (points, tool, author) is sent via `whiteboard_stroke` WebSocket message.
- **Remote Cursors** — Tracked and rendered for all participants; throttled to one update per 50ms to prevent WebSocket congestion.
- **Smooth Rendering** — Uses `quadraticCurveTo` for smooth path rendering.
- **Auto-Save** — Whiteboard state is saved to `localStorage` as a DataURL via `triggerAutoSave`.
- **User Colors** — `getUserColor()` deterministically assigns a color per username.

---

### Chat & AI Integration

- **Message Schema** — `ChatMessage { senderId, timestamp, imageUrl?, isAi? }`
- **Image Compression** — Images are resized to max 800px and converted to JPEG at 0.6 quality using a hidden canvas before sending, minimizing WebSocket payload size.
- **Markdown Rendering** — Messages are rendered with `ReactMarkdown` for rich formatting and syntax-highlighted code blocks.
- **AI Streaming** — The `ask_ai` message triggers the Gemini handler on the WebSocket server. Each text chunk is published as `chat_ai_chunk` to Redis, relayed to the frontend, and appended to the last AI message in real-time, creating a typing effect.
- **AI Model** — `gemini-2.5-flash-lite` via `@google/generative-ai` SDK.
- **Context-Aware** — The editor's context menu can trigger AI actions (e.g., "Explain Code", "Fix Errors") with the selected code and language automatically included in the prompt.

---

## Infrastructure & Deployment

### AWS Deployment Topology

```mermaid
graph TD
    subgraph "Public Internet"
        Browser["Browser Client"]
    end

    subgraph "AWS Cloud"
        subgraph "Vercel CDN"
            FE["Frontend (React SPA)"]
        end

        subgraph "ECS Cluster"
            EX["express-server (Port 3000)"]
            WK["worker (Background)"]
        end

        subgraph "EC2 Instance"
            WS["websocket-server (Ports 5000 / 5001)"]
        end

        subgraph "ElastiCache / Redis"
            RL[["List: 'problems'"]]
            RP[["Pub/Sub: roomId"]]
            RH[["Hash: room:roomId:users"]]
        end
    end

    Browser -- "HTTPS" --> FE
    Browser -- "HTTP POST /submit" --> EX
    Browser -- "WebSocket" --> WS
    EX -- "lPush" --> RL
    WK -- "brPop" --> RL
    WK -- "publish" --> RP
    WS -- "subscribe" --> RP
    WS -- "hSet / hGetAll" --> RH
    WS -- "ws.send" --> Browser
```

| Service | Host | Port(s) | Notes |
|---|---|---|---|
| Frontend | Vercel | 443 (HTTPS) | Global CDN delivery |
| Express Server | AWS ECS | 3000 | Stateless; auto-scalable |
| Worker | AWS ECS | N/A | Background job processor |
| WebSocket Server | AWS EC2 | 5000, 5001 | Stateful; long-lived connections |

EC2 is used for the WebSocket server specifically to support persistent, long-lived connections that ECS's load balancer model does not handle as cleanly.

---

### Docker Configuration

All backend services are containerized using **multi-stage Dockerfiles**.

**Express Server & WebSocket Server (Multi-Stage):**

```mermaid
graph TD
    subgraph "Builder Stage (node:18)"
        A["COPY package*.json"] --> B["npm install"]
        C["COPY src/ tsconfig.json"] --> D["npm run build (tsc)"]
        B --> D
    end
    subgraph "Runner Stage (node:18)"
        D --> E["COPY dist/"]
        B --> F["COPY node_modules/"]
        E & F --> G["CMD npm run start"]
    end
```

**Worker (Specialized Image):**

The Worker image is built on `node:18` and pre-installs all language runtimes needed to spawn execution containers:

- `python3`, `python3-pip`
- `build-essential` (GCC for C++)
- `golang`

It also creates a non-root user `myuser` and transfers ownership of `/usr/src/app` to it before startup, providing defense-in-depth against privilege escalation.

---

## Environment Variables

### `apps/express-server`

```env
PORT=3000
REDIS_URL=redis://localhost:6379
```

### `apps/websocket-server`

```env
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_google_gemini_api_key
```

### `apps/worker`

```env
REDIS_URL=redis://localhost:6379
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 10.8.1
- Docker (running, for the Worker service)
- Redis instance (local or remote)

### Installation

```bash
# Clone the repository
git clone https://github.com/harshitzofficial/SYNC-CODE.git
cd SYNC-CODE

# Install all dependencies across all workspaces
npm install
```

### Development

Create `.env` files in each service directory (see [Environment Variables](#environment-variables)), then:

```bash
# Start all services in parallel (Turborepo)
npm run dev
```

This starts:
- `apps/frontend` — Vite dev server
- `apps/express-server` — Express API
- `apps/websocket-server` — WebSocket signaling + Yjs sync
- `apps/worker` — Redis job consumer

### Build

```bash
npm run build
```

Compiles all TypeScript services to `dist/` and builds the frontend to `dist/assets/`.

---

## Supported Languages

| Language | File | Docker Image |
|---|---|---|
| JavaScript | `userCode.js` | `node:18-alpine` |
| Python | `userCode.py` | `python:3.9-alpine` |
| C++ | `userCode.cpp` | `gcc:latest` |
| Go | `userCode.go` | `golang:1.20-alpine` |

Monaco Editor is also enhanced with custom code snippets for JavaScript, Python, C++, Java, Rust, and Go (e.g., `forloop`, `main`, print statements) via `registerMonacoSnippets`.

---

## Security Model

| Threat | Mitigation |
|---|---|
| Network access from user code | `--network none` on execution containers |
| Memory exhaustion (OOM) | `--memory="512m"` per container |
| CPU exhaustion (infinite loops) | `--cpus="0.5"` per container |
| Long-running processes | 20-second `exec` timeout |
| Container filesystem persistence | `--rm` flag auto-removes containers |
| Disk exhaustion | `fs.rm(codeDir, { recursive: true })` after every execution |
| Privilege escalation in Worker | Worker runs as non-root `myuser` |
| Build-time dependency leakage | Multi-stage Docker builds exclude `devDependencies` from runner images |

---

## Glossary

| Term | Definition |
|---|---|
| **CRDT** | Conflict-free Replicated Data Type — a data structure allowing concurrent updates that always converge. Used via `Yjs` for the code editor. |
| **Dual WebSocket Strategy** | Running two WebSocket servers (port 5000 for signaling, port 5001 for Yjs CRDT sync) to separate concerns. |
| **Perfect Negotiation** | A WebRTC pattern to resolve simultaneous offer collisions. The "polite" peer (higher `userId`) rolls back its offer on glare. |
| **brPop** | Redis blocking pop — the Worker uses this to wait indefinitely for new jobs in the `problems` list without busy-waiting. |
| **Sandboxing** | Running user code inside ephemeral Docker containers with `--network none` and strict resource limits. |
| **Recoil Atoms** | Units of global state in the React frontend (`userAtom`, `socketAtom`, `connectedUsersAtom`). |
| **Monaco Editor** | The VS Code editor engine embedded in the frontend for the code workspace. |
| **Turborepo** | Monorepo build orchestration tool that runs tasks across all workspaces in parallel with caching. |
| **`problems` list** | The Redis List key used as the FIFO job queue between the Express server (producer) and Worker (consumer). |
| **`room:{roomId}:users`** | Redis Hash key storing `userId → name` mappings for distributed presence tracking. |
| **Gemini AI** | Google's `gemini-2.5-flash-lite` model used as the AI Pair Programmer, accessed via `@google/generative-ai`. |
``` [1](#0-0) [2](#0-1)

### Citations

**File:** package.json (L1-24)
```json
{
  "devDependencies": {
    "prettier": "^3.2.5",
    "turbo": "^2.2.3",
    "typescript": "5.5.4"
  },
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "packageManager": "npm@10.8.1",
  "dependencies": {
    "y-websocket": "^1.5.0"
  }
}
```

**File:** turbo.json (L1-15)
```json
{
    "$schema": "https://turborepo.com/schema.json",
    "tasks": {
      "build": {
        "outputs": ["dist/**"]
      },
      "check-types": {
        "dependsOn": ["^check-types"]
      },
      "dev": {
        "persistent": true,
        "cache": false
      }
    }
  }
```
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/harshitzofficial/SYNC-CODE)
