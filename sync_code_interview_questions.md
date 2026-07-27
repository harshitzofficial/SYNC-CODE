# SYNC-CODE — Interview Questions

A comprehensive list of interview questions an interviewer may ask based on this project. Questions are organized by topic and difficulty.

---

## 🏗️ System Design & Architecture

### Basic
1. **Walk me through the overall architecture of SYNC-CODE. How do the four services communicate with each other?**
2. **Why did you choose a microservices/monorepo approach instead of a monolith? What are the trade-offs?**
3. **What is Turborepo and why is it used here? How does `turbo.json` help with the build pipeline?**
4. **What is the purpose of the Express server if the WebSocket server already handles real-time communication?**

### Intermediate
5. **Why are there two separate WebSocket servers (port 5000 and 5001)? What problem does this separation solve?**
6. **Explain the full lifecycle of a code submission — from the user clicking "Run" to seeing the output.**
7. **Why is the Express server described as "stateless"? What would make a server stateful, and why does it matter for scaling?**
8. **How does the "Request For All Data" pattern work when a new user joins a room? Why is this necessary when you already have CRDTs?**

### Advanced
9. **How would you horizontally scale the WebSocket server? What challenges arise, and how does Redis Pub/Sub solve them?**
10. **The server only subscribes to a Redis Pub/Sub channel when the first user joins (`rooms[roomId].length === 1`). Explain why this optimization is important and what could go wrong without it.**
11. **If you had 10 WebSocket server instances and a user connects to instance A while another connects to instance B in the same room, how does the message still reach both users?**
12. **How would you redesign this architecture to support millions of concurrent users?**

---

## 🔄 Real-Time Collaboration & CRDTs

### Basic
13. **What is a CRDT? What problem does it solve that traditional locking mechanisms cannot?**
14. **What is Yjs, and why is it used here instead of Operational Transformation (OT)?**
15. **What is `y-monaco`? How does it bridge Yjs with the Monaco Editor?**

### Intermediate
16. **What is a `Y.Doc` and a `Y.Text`? How does the `WebsocketProvider` keep them in sync across users?**
17. **What happens to document state when two users simultaneously edit the same line? How does Yjs resolve this conflict?**
18. **Why is CRDT traffic sent over port 5001 (binary) while other messages go over port 5000 (JSON)?**
19. **How does the whiteboard handle remote cursor tracking without flooding the WebSocket with too many events?** *(Hint: throttling to 50ms)*

### Advanced
20. **Explain the dual-canvas architecture used in the whiteboard. Why have a separate overlay canvas for active strokes?**
21. **CRDTs guarantee eventual consistency. What does "eventual consistency" mean in the context of this project?**
22. **How does `quadraticCurveTo` improve the whiteboard drawing experience over simple `lineTo` calls?**

---

## 🔌 WebSockets & WebRTC

### Basic
23. **What is the difference between HTTP and WebSockets? Why are WebSockets used for this application?**
24. **What is WebRTC? How is it different from WebSockets for audio/video communication?**
25. **What is a STUN server? Why is it needed for WebRTC to work across different networks?**

### Intermediate
26. **Explain the WebRTC handshake: what are an Offer, Answer, and ICE Candidate, and what role does the signaling server play?**
27. **What is a "mesh topology" in the context of WebRTC? What are its advantages and disadvantages compared to an SFU (Selective Forwarding Unit)?**
28. **What is "glare" in WebRTC? How does the Perfect Negotiation pattern resolve simultaneous offer collisions?**
29. **How does the `useWebRTC` hook manage peer connections when a user turns their camera on or off?**

### Advanced
30. **At what number of users would a mesh WebRTC topology become impractical? What would you use instead (SFU/MCU) and why?**
31. **How would you implement TURN server support for users behind strict NAT/firewalls where STUN is not sufficient?**
32. **How does the WebSocket server route WebRTC messages directly (point-to-point) between two specific users instead of broadcasting?**

---

## 📦 Redis

### Basic
33. **What are the three different ways Redis is used in this project? Name the Redis primitive for each.**
34. **What is `lPush` / `brPop`? How do they implement a job queue?**
35. **What is Redis Pub/Sub? How is it different from a message queue like Kafka or RabbitMQ?**

### Intermediate
36. **Why does `brPop` use a blocking timeout of `0` in the worker? What would happen with a non-blocking `lPop`?**
37. **What is a Redis Hash? Why is it used for presence tracking (`room:roomId:users`) instead of a Redis Set or List?**
38. **When a user disconnects, the server calls `hDel` to remove them from the Hash. What happens if the server crashes before this call? How would you handle this "ghost user" problem?**
39. **Why are two separate Redis clients (`pubSubClient` and `publisherClient`) used in the WebSocket server? Can't you use a single client?**

### Advanced
40. **Redis Pub/Sub has no message persistence. If the WebSocket server restarts, it loses all subscriptions. How would you make the system more resilient?**
41. **How would you replace the Redis List job queue with a more robust alternative like BullMQ or a cloud queue (SQS)? What would you gain?**

---

## 🐳 Docker & Security

### Basic
42. **What is Docker? Why is it used to run user-submitted code instead of running it directly on the host machine?**
43. **What does the `--rm` flag do in the Docker run command?**
44. **What is a multi-stage Dockerfile? What advantage does it provide over a single-stage build?**

### Intermediate
45. **Explain each security constraint on the execution container: `--network none`, `--memory 512m`, `--cpus 0.5`. What specific attack does each one prevent?**
46. **A user submits code with an infinite loop (`while(true){}`). What happens? Trace the execution path including the timeout mechanism.**
47. **The worker creates a non-root user `myuser` in its Dockerfile. Why is running as a non-root user inside a container important for security?**
48. **What is a volume mount (`-v`)? Why is the temp directory mounted into the container instead of copying files in with `COPY`?**

### Advanced
49. **What is a container escape vulnerability? Even with `--network none`, what other attack vectors could a malicious user exploit? How would you further harden this setup? (e.g., seccomp profiles, gVisor)**
50. **The code directory is named `user-{timestamp}`. Could this cause a collision? How would you improve this?** *(Hint: the README uses `submissionId = "submission-" + Date.now() + "-" + roomId`)*
51. **How does Docker's `--cpus` flag work at the kernel level (CFS scheduler)?**

---

## ⚛️ Frontend: React, State Management & TypeScript

### Basic
52. **What is Recoil? How is it different from React's built-in `useState` or `useContext`?**
53. **What are Recoil Atoms? Name the three atoms used in this project and what each one stores.**
54. **What is `ProtectedRouter`? How does it prevent unauthorized access to the `/code/:roomId` route?**

### Intermediate
55. **Why is code and input saved to `localStorage` on every change? What user experience problem does this solve?**
56. **How does the `useWebRTC` hook manage the lifecycle of multiple `RTCPeerConnection` objects? How does it clean them up?**
57. **How does the context menu in Monaco Editor trigger an AI action? What data is passed to the `ask_ai` WebSocket message?**
58. **How is image sharing implemented in the chat? Why is compression applied before sending?** *(Hint: max 800px, JPEG 0.6 quality)*
59. **Explain how AI streaming responses are rendered in real-time in the chat. Trace the message from clicking "Ask AI" to seeing text appear character by character.**

### Advanced
60. **What is `class-variance-authority` (CVA)? How does it relate to `shadcn/ui` and component variant management?**
61. **What is Framer Motion used for? Give a specific example of where micro-animations improve the user experience in this project.**
62. **How does Vite differ from Create React App (CRA)? Why is it faster for development builds?**

---

## 🤖 AI Integration

### Basic
63. **Which AI model is used in this project? What is it used for?**
64. **What does "streaming response" mean in the context of the Gemini API? How does it improve the user experience?**

### Intermediate
65. **Trace the path of an AI request: from the user's browser to the Gemini API and back. Which services are involved?**
66. **Why is the AI streaming handled server-side on the WebSocket server rather than making the API call directly from the frontend?**
67. **How does the AI have context about the current code? What information is included in the prompt?**

### Advanced
68. **What are the risks of exposing an AI API key in the backend? How is it protected in this architecture?**
69. **If you wanted to add "conversation history" so the AI remembers previous questions in the same session, how would you implement that?**

---

## 🚀 Deployment & DevOps

### Basic
70. **Why is the frontend deployed on Vercel but the backend on AWS EC2? What are the respective strengths of each platform?**
71. **What is the role of a `.env` file? Why should it never be committed to version control?**
72. **What are the ports that need to be opened in the EC2 Security Group? What does each one serve?**

### Intermediate
73. **Why does the README mention mixed-content errors when connecting an HTTPS frontend to an HTTP backend? How is this resolved?**
74. **What is an Nginx reverse proxy? How would you use it to route traffic on port 443 to the backend services on ports 3000, 5000, and 5001?**
75. **What is `npm workspaces`? How does it differ from having three separate repos?**
76. **The WebSocket server is deployed on EC2 instead of a serverless platform (like AWS Lambda). Why?**

### Advanced
77. **How would you add Zero-Downtime Deployment (ZDD) for the WebSocket server? What challenge do long-lived WebSocket connections create for rolling deployments?**
78. **How would you monitor this system in production? What metrics would you track for the Redis queue, the Worker, and the WebSocket server?**
79. **If the Worker crashes mid-execution, the job is lost from the Redis List (since `brPop` already removed it). How would you implement job retry/dead-letter queue logic?**

---

## 💡 Problem-Solving & Design Decisions

80. **What was the hardest technical problem you faced building this project, and how did you solve it?**
81. **Why did you choose Monaco Editor over alternatives like CodeMirror 6 or Ace Editor?**
82. **What would you change or improve if you were to rebuild this project from scratch?**
83. **How would you add user authentication (login/signup) to this project? What would need to change in the session flow?**
84. **The current whiteboard state is not persisted to a database — it's only in `localStorage`. How would you persist whiteboard state server-side?**
85. **How would you add support for a new programming language like Java or Rust?**

---

> **Tip for answers**: For system design questions, always draw the architecture diagram, mention trade-offs, and discuss how you'd scale each component. For coding questions, be ready to open the actual source files and walk through the code.
