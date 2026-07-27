# High Level Design (HLD) - SYNC-CODE

The following architectural diagram illustrates the complete system topology of the SYNC-CODE project, demonstrating how the frontend, proxy layer, backend microservices, data layer, and external APIs interact.

## Complete Architecture Topology

```mermaid
graph TB
    subgraph Client_Layer
        direction LR
        UserA["User A Browser"]
        UserB["User B Browser"]
        
        UserA <.->|"WebRTC Direct P2P Audio/Video"| UserB
    end

    subgraph Frontend_Hosting
        Vercel["Vercel CDN"]
    end
    
    Vercel -.->|"Serves React/Vite assets"| Client_Layer

    subgraph AWS_EC2_Instance
        subgraph Reverse_Proxy_Layer
            Nginx["Nginx + Certbot SSL"]
        end

        subgraph Docker_Compose_Environment
            API["Express Server Port 3000"]
            WS["WebSocket Server Port 5000"]
            YJS_WS["Yjs Server Port 5001"]
            Worker["Worker Service"]
            
            subgraph Isolated_Execution
                ExecContainers["Language Sandboxes"]
            end
            
            Worker -->|"Spawns / Runs Code in"| Isolated_Execution
        end
        
        subgraph Data_Storage
            Redis[("Redis")]
            RedisLists{{"Redis Lists"}}
            RedisPubSub(("Redis Pub/Sub"))
            RedisHash{{"Redis Hashes"}}
            
            Redis --- RedisLists
            Redis --- RedisPubSub
            Redis --- RedisHash
        end
    end
    
    subgraph External_APIs
        Gemini["Google Gemini API"]
    end

    Client_Layer -->|"HTTPS REST API"| Nginx
    Client_Layer <-->|"WSS (Chat, Whiteboard, Signaling)"| Nginx
    Client_Layer <-->|"WSS (Monaco CRDT Sync)"| Nginx
    
    Nginx -->|"Proxy /api"| API
    Nginx -->|"Proxy /ws"| WS
    Nginx -->|"Proxy /yjs"| YJS_WS
    
    API -->|"1. lPush (Send Code Job)"| RedisLists
    Worker -->|"2. brPop (Receive Code Job)"| RedisLists
    Worker -->|"3. publish (Send Output)"| RedisPubSub
    
    WS <-->|"publish / subscribe"| RedisPubSub
    WS <-->|"hSet / hGetAll"| RedisHash
    
    WS <-->|"Streaming Prompts & Responses"| Gemini
```

## Component Breakdown

1. **Client Layer**: A React frontend using Vite, heavily relying on Monaco Editor for code input, Yjs for CRDT-based operational transformations (real-time typing sync), and native WebRTC APIs for peer-to-peer mesh video calling.
2. **Nginx Reverse Proxy**: Acts as the single entry point to the AWS backend. Terminated SSL (from Certbot) and routes traffic via URL paths (`/api`, `/ws`, `/yjs`) to the isolated Docker containers.
3. **Backend Services (Node.js)**:
   - **Express**: Handles standard HTTP requests (auth, saving state, triggering code execution).
   - **WebSocket (Port 5000)**: A custom WS implementation routing WebRTC signaling (offers/answers/ICE), chat messages, Whiteboard coordinates, and acting as a proxy to the Gemini AI API.
   - **Yjs Server (Port 5001)**: The standard `y-websocket` server dedicated exclusively to keeping the Monaco Editor document synced across clients.
   - **Worker**: A detached background service.
4. **Data Layer (Redis)**: The central nervous system of the backend, utilized for Pub/Sub messaging, presence tracking (Hashes), and a persistent job queue (Lists) to offload heavy code-execution tasks.
