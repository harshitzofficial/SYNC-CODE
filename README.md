## 🏗️ System Architecture

```mermaid
flowchart TD

%% Client
A["Frontend - React Vite"] -->|"Custom WS Port 5000"| B["WebSocket Server"]
A -->|"HTTP POST /submit"| C["Express API"]

%% WebSocket Layer
B -->|"SUBSCRIBE / PUBLISH"| D["Redis"]
D -->|"Message Relay"| B

%% Queue System
D -->|"LPUSH problems"| D
D -->|"BRPOP problems"| E["Worker"]

%% Execution Layer
C --> E
E -->|"Run Code"| E
E -->|"Publish result"| D

%% Back to Client
D --> B
B --> A
