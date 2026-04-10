# SYNC-CODE  
  
A high-performance, real-time collaborative coding platform designed for seamless teamwork and remote technical interviews. SYNC-CODE integrates real-time text synchronization, multi-user whiteboard collaboration, instant messaging, AI-assisted pair programming, and sandboxed code execution across multiple programming languages.  
  
Built as a modern distributed system, it leverages **CRDTs (Conflict-free Replicated Data Types)** for document consistency and a **Redis-backed messaging architecture** to ensure low-latency communication between users.  
  
---  
  
## Table of Contents  
  
- [Core Capabilities](#core-capabilities)  
- [System Architecture](#system-architecture)  
- [Monorepo Structure & Tooling](#monorepo-structure--tooling)  
- [Getting Started & Local Development](#getting-started--local-development)  
- [WebSocket Server](#websocket-server)  
  - [Message Router & Protocol](#message-router--protocol)  
- [Express Server (Submission API)](#express-server-submission-api)  
- [Code Execution Worker](#code-execution-worker)  
- [Frontend Application](#frontend-application)  
  - [Session Registration & Room Management](#session-registration--room-management)  
  - [Collaborative Code Editor](#collaborative-code-editor)  
  - [Collaborative Whiteboard](#collaborative-whiteboard)  
  - [Group Chat & AI Assistant](#group-chat--ai-assistant)  
  - [Video Conferencing (WebRTC)](#video-conferencing-webrtc)  
  - [State Management & UI Components](#state-management--ui-components)  
- [Real-Time Synchronization Architecture](#real-time-synchronization-architecture)  
  - [Yjs CRDT & Monaco Binding](#yjs-crdt--monaco-binding)  
  - [Redis Pub/Sub & Room Scaling](#redis-pubsub--room-scaling)  
- [Glossary](#glossary)  
  
---  
  
## Core Capabilities  
  
- **Real-time Collaboration**: Simultaneous code editing using `Yjs` and `Monaco Editor`.  
- **Sandboxed Execution**: Remote code execution for JavaScript, Python, C++, and Go using Docker-based isolation.  
- **Multi-modal Communication**: Integrated WebRTC video conferencing, group chat with image support, and a shared whiteboard.  
- **AI Integration**: Context-aware coding assistance powered by Google Gemini.  
  
---  
  
## System Architecture  
  
The platform is composed of four distinct services that interact via WebSockets, REST APIs, and Redis Pub/Sub.  
  
```mermaid  
graph TD  
    subgraph "Client Side"  
        A["Frontend (React/Vite)"]  
    end  
  
    subgraph "Real-Time Layer"  
        B["WebSocket Server (Port 5000/5001)"]  
        C["Redis (Pub/Sub & State)"]  
    end  
  
    subgraph "Execution Layer"  
        D["Express Server (API)"]  
        E["Worker (Code Runner)"]  
    end  
  
    A -- "y-websocket (Port 5001)" --> B  
    A -- "Custom WS Protocol (Port 5000)" --> B  
    A -- "HTTP POST /submit" --> D  
    D -- "LPUSH 'problems'" --> C  
    E -- "BRPOP 'problems'" --> C  
    B -- "SUBSCRIBE/PUBLISH" --> C  
    E -- "PUBLISH result" --> C  
    C -- "Message Relay" --> B
