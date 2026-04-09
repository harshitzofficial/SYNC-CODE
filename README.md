<div align="center">

# ⚡ CodeSync — Collaborative Cloud IDE

### A real-time collaborative code editor that lets multiple users write and execute code together in the cloud, with instant shared output.

[![TypeScript](https://img.shields.io/badge/TypeScript-88.3%25-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![AWS](https://img.shields.io/badge/AWS-EC2%20%7C%20ECS-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)

**Perfect for remote interviews, pair programming, and team coding sessions.**

</div>



---

## 🌟 Overview

**CodeSync** is a full-stack, cloud-native collaborative IDE that enables multiple developers to write and run code together in real time — directly from the browser. No local setup required. Code changes propagate instantly across all connected clients, and execution happens inside secure, isolated Docker containers to ensure a safe sandboxed environment.

Whether you're conducting a technical interview, pair programming with a colleague, or running a remote coding workshop, CodeSync provides the infrastructure to collaborate at scale.

---

## 🏛️ System Design

### Cloud IDE Architecture

<img width="1111" height="601" alt="image" src="https://github.com/user-attachments/assets/517bfa0b-995c-47f6-95dc-74a01bc73aec" />


### Collaborative Code Editor Architecture

<img width="940" height="749" alt="image" src="https://github.com/user-attachments/assets/87fd2383-9189-4568-9f48-e667d2e56efd" />


---

## ✨ Features

| Feature | Description |
|---|---|
| 🤝 **Real-Time Collaboration** | Multiple users can write code simultaneously with instant, conflict-free synchronization |
| ☁️ **Browser-Based IDE** | Fully functional IDE accessible from any browser — no local installation needed |
| 🔒 **Secure Code Execution** | Code runs inside isolated Docker containers, preventing any impact on the host system |
| 📡 **WebSocket Communication** | Persistent, low-latency bidirectional connections for seamless real-time updates |
| ⚙️ **Scalable Queue Processing** | Redis-backed job queue ensures reliable, ordered code execution under load |
| 🚀 **Cloud-Native Deployment** | Each service independently deployed on AWS (ECS / EC2) for high availability |

---

## 💻 Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React** | UI component library for building the interactive IDE interface |
| **Recoil** | Atom-based state management for efficient, fine-grained UI updates |
| **TypeScript** | Type-safe development across the entire frontend codebase |

### Backend

| Technology | Purpose |
|---|---|
| **Node.js** | JavaScript runtime powering all backend services |
| **Express.js** | RESTful API server for handling code submission requests |
| **WebSocket (ws)** | Real-time bidirectional communication for collaborative editing |
| **Redis Queue** | Job queue for reliable, ordered submission of code execution tasks |
| **Redis Pub/Sub** | Event-driven messaging between backend services (e.g., worker → websocket notifications) |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Docker** | Containerized, isolated execution environments for running untrusted code |
| **AWS EC2** | Hosts the dedicated WebSocket server |
| **AWS ECS** | Container orchestration for the Express server and Worker services |
| **Vercel** | Frontend hosting with global CDN and zero-config deployments |
| **Turborepo** | Monorepo build system for optimized task orchestration |

---

## 🏗️ Architecture

The project is structured as a **Turborepo monorepo**, with four independently deployable services:

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Client                      │
│              (React + Recoil — Vercel)                  │
└────────────────────┬────────────────┬───────────────────┘
                     │ HTTP           │ WebSocket
                     ▼                ▼
          ┌──────────────┐   ┌─────────────────┐
          │ Express      │   │  WebSocket      │
          │ Server       │   │  Server         │
          │ (AWS ECS)    │   │  (AWS EC2)      │
          └──────┬───────┘   └────────┬────────┘
                 │ Enqueue            │ Subscribe
                 ▼                    ▼
          ┌────────────────────────────────────┐
          │            Redis                   │
          │   Queue (jobs) + Pub/Sub (events)  │
          └───────────────┬────────────────────┘
                          │ Dequeue
                          ▼
                 ┌─────────────────┐
                 │     Worker      │
                 │   (AWS ECS)     │
                 │  Docker Exec    │
                 └─────────────────┘
```

### Service Breakdown

#### `frontend`
The user-facing React application providing the collaborative IDE interface.
- **Hosting:** Vercel
- **URL:** [real-time-code-box-frontend.vercel.app](https://real-time-code-box-frontend.vercel.app)

#### `express-server`
Handles REST API requests and pushes code submission jobs to the Redis queue.
- **Hosting:** AWS ECS

#### `websocket-server`
Manages all real-time WebSocket connections for code synchronization between collaborators. Subscribes to Redis Pub/Sub to relay execution results back to clients.
- **Hosting:** AWS EC2

#### `worker`
Dequeues code execution jobs from Redis, runs code inside isolated Docker containers, and publishes results back via Redis Pub/Sub.
- **Hosting:** AWS ECS

---

## 📁 Project Structure

```
CodeSync-Collaborative-Cloud-IDE/
├── apps/
│   ├── frontend/          # React + Recoil client application
│   ├── express-server/    # REST API server (code submission)
│   ├── websocket-server/  # WebSocket server (real-time sync)
│   └── worker/            # Code execution worker (Docker)
├── .gitignore
├── package.json           # Root workspace config (npm workspaces)
├── turbo.json             # Turborepo pipeline config
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>= 18`
- **npm** `>= 10.8.1`
- **Docker** (for the worker service)
- **Redis** instance (local or cloud)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/anshtale/CodeSync-Collaborative-Cloud-IDE.git
cd CodeSync-Collaborative-Cloud-IDE
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create `.env` files in each service directory (see [Environment Variables](#environment-variables)).

4. **Run all services in development mode**

```bash
npm run dev
```

This uses Turborepo to start all apps concurrently with hot-reloading.

5. **Build for production**

```bash
npm run build
```

### Running Individual Services

```bash
# Frontend only
cd apps/frontend && npm run dev

# Express server only
cd apps/express-server && npm run dev

# WebSocket server only
cd apps/websocket-server && npm run dev

# Worker only
cd apps/worker && npm run dev
```

---

## 🔧 Environment Variables

Configure the following environment variables for each service:

### `express-server`

```env
PORT=3001
REDIS_URL=redis://localhost:6379
```

### `websocket-server`

```env
PORT=3002
REDIS_URL=redis://localhost:6379
```

### `worker`

```env
REDIS_URL=redis://localhost:6379
DOCKER_IMAGE=node:18-alpine   # or any supported runtime image
```

### `frontend`

```env
VITE_EXPRESS_SERVER_URL=http://localhost:3001
VITE_WS_SERVER_URL=ws://localhost:3002
```

---

## ☁️ Deployment

| Service | Platform | Notes |
|---|---|---|
| `frontend` | **Vercel** | Connect repo, set env vars, auto-deploys on push |
| `express-server` | **AWS ECS** | Dockerize and push to ECR, deploy as ECS service |
| `websocket-server` | **AWS EC2** | SSH into instance, run with PM2 or systemd |
| `worker` | **AWS ECS** | Requires Docker-in-Docker or privileged container mode |

> **Note:** Ensure your Redis instance is accessible from all deployed services. AWS ElastiCache (Redis) is recommended for production.

---

<div align="center">

Made with ❤️ by **Harshit Singh**

⭐ Star this repo if you found it helpful!

</div>

-----------------------------------------------------------------------------------------------------------------------------------
To run the **CodeSync - Collaborative Cloud IDE** project, you need to set up the infrastructure (Redis and Docker) and then start the Turborepo services.

### 1. Prerequisites
Ensure you have the following installed:
*   **Node.js** (>= 18)
*   **npm** (>= 10)
*   **Docker Desktop** (Required for the `worker` service)
*   **Redis** (Local or via Docker)

---

### 2. Setup Infrastructure
The application relies on Redis for task queuing and Docker for isolated code execution.

**Start Redis:**
If you have Docker, you can quickly start a Redis instance with:
```bash
docker run -d -p 6379:6379 --name redis redis
```

**Start Docker:**
Ensure **Docker Desktop** is running on your machine, as the `worker` service will attempt to pull the `node:18-alpine` image to execute code.

---

### 3. Installation & Preparation
Navigate to the project root and install all dependencies:

```bash
# In the root directory: CodeSync-Collaborative-Cloud-IDE-master
npm install
```

**Environment Variables:**
Check that the `.env` files exist in the following directories (they usually point to `localhost` by default):
*   `apps/express-server/.env`
*   `apps/websocket-server/.env`
*   `apps/worker/.env`
*   `apps/frontend/.env`

---

### 4. Running the Project
Since this is a **Turborepo** project, you can start all services (Frontend, Express Server, WebSocket Server, and Worker) with a single command from the root:

```bash
npm run dev
```

### 5. Accessing the IDE
Once the services are running:
*   **Frontend**: Open [http://localhost:5173](http://localhost:5173) (or the URL shown in your terminal).
*   **Backend API**: Running on [http://localhost:3001](http://localhost:3001).
*   **WebSocket**: Running on port `3002`.

---

### Troubleshooting
*   **Worker fails to execute code**: Ensure Docker is running and you have permissions to run `docker exec`.
*   **Redis Connection Error**: Ensure your Redis instance is reachable at `redis://localhost:6379`.
*   **Individual Services**: If you need to run only one service for debugging, you can `cd` into its directory in `apps/` and run `npm run dev` there.

# CodeSync Architecture & System Documentation

CodeSync is a real-time, highly-collaborative cloud IDE. Our platform is designed with a service-oriented architecture specifically tuned for scaling WebSockets and safely queueing user script execution.

---

## 🏗 Tech Stack overview

### Frontend Application
- **Framework**: React.js mapped with Vite & TypeScript for fast, safe component rendering.
- **State Management**: Recoil (Chosen over Redux for lightweight, atom-based fast state changes across multiplayer hooks).
- **Code Editor Framework**: `@monaco-editor/react` (The same core engine used in VS Code).
- **Real-Time Engines**: 
  - **WebSockets** (Native) for extremely fast string-based payloads (Chat, Code Sync, Whiteboard Strokes).
  - **WebRTC** natively implemented via custom hooks for peering Audio & Video strictly browser-to-browser to save server bandwidth.
- **Styling**: Tailwind CSS & generic CSS.

### Backend Microservices
Because monolithic servers crash if parsing gigabytes of WebSockets concurrently with heavy C++ compiling, we split the backend logically:
1. **Express REST Server**: Pure HTTP server (Port 3000) dedicated solely to ingesting `POST /submit` requests for code execution.
2. **WebSocket Node Server**: Pure `ws` server (Port 5000) dedicated *exclusively* to keeping thousands of TCP connections open parsing live cursors, code changes, and WebRTC handshakes. 
3. **Execution Worker Process**: An independent Node process utilizing `child_process.exec()` explicitly for churning through untrusted user code files cleanly.

---

## ⚡ The Event Loop: How Creating a Room Works

When a user joins or creates a room:
1. **Connection Initialization**: The React Frontend opens a WebSocket tunnel pointing to the WebSocket-Server. It passes a Query URL like `?roomId=f3dzi4&id=48277`.
2. **Room Registration**: 
   - If `rooms[roomId]` does not exist in the server's memory heap, it instantiates an array and tags the user as the "creator".
   - It then broadcasts a `"users"` payload to the current players informing them a new member has connected.
3. **P2P Audio/Video Mesh (WebRTC)**:
   - When user "B" joins the room, they instantly emit a `webrtc_offer` through the WebSocket to user "A".
   - User "A" intercepts it and responds with a `webrtc_answer`.
   - Both browsers then fire off `webrtc_ice_candidate` packets through the WebSockets. Once resolved, **browsers connect to each other directly via WebRTC**, bypassing the server entirely for Audio and Video!
4. **State Emulation**: When typing in Monaco, changes are mapped to `onChange` and pushed heavily as JSON `{"type": "code", "code": "..."}` strings, which the router `broadcastToOthers()` safely rebounds to peers.

---

## 🧠 Why Do We Use Redis?

In our architecture, Redis solves two massive bottlenecks: Queueing Execution and Microservice Communication.

1. **Job Queueing (`lPush` & `brPop`)**
   - When a user clicks "Run Code", the HTTP `Express Server` blindly receives the payload and pushes it instantly to a Redis List (`redisClient.lPush("problems")`). It immediately responds `200 OK` to keeping routing fast!
   - Our `Worker Process` sits completely identically on a blocking poll (`client.brPop("problems")`). This ensures that if 100 users hit "Run" at once, the system doesn't crash; the workers simply pop them off the queue one by one securely.
2. **Pub/Sub Architecture**
   - After the Worker finishes executing the C++ logic, it doesn't know *who* or *where* the user is via WebSocket. 
   - Instead, the Worker simply publishes the terminal response back to Redis: `pubClient.publish(roomId, result)`.
   - Because our `WebSocket-Server` subbed to Redis at launch (`pubSubClient.subscribe(roomId)`), it instantaneously hears Redis scream, knows which websocket belongs to that room, and pings the `Output` console on the frontend!

---

## 🐳 Why Does Docker Run All of This?

Docker isn't just used for convenience here—it is a **massive security and standardization requirement** for our execution workers.

1. **Host Sandboxing (Security)**
   - The worker executes arbitrary user code through `child_process.exec`. If a malicious user types `"javascript code: require('child_process').execSync('rm -rf /')"` or tries to read passwords from the host OS, running this plainly on a Macbook or AWS Linux box would destroy the machine.
   - Operating the worker dynamically inside a sterile Docker container walls off the root environment cleanly preventing breakout.
2. **Compiler Uniformity**
   - Generating execution commands like `python3`, `g++`, and `go run` demands the machine physically has all these distinct language compilers globally mapped to accurate PATH versions.
   - Using a Docker Image ensures that regardless of who deploys the server, the Python, C++, Go, and NodeJS environments boot flawlessly every single time because it's built off an identical Linux blueprint map.
