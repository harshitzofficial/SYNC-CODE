# Deployment Guide for SYNC-CODE

This is a comprehensive, step-by-step guide to deploying your Turbo Repo project (`SYNC-CODE`) using Vercel for the frontend and AWS for your backend services (Express API, WebSockets, Worker, and Redis).

## Architecture Overview

*   **Frontend**: React + Vite application (deployed on Vercel).
*   **Express Server**: Handles REST API requests on port `3000` (deployed on AWS EC2).
*   **WebSocket Server**: Handles WebSockets on port `5000` and YJS sync on port `5001` (deployed on AWS EC2).
*   **Worker**: Background service processing jobs from Redis (deployed on AWS EC2).
*   **Redis**: Shared memory database used for pub/sub and queues (deployed on AWS EC2 or ElastiCache).

---

## Part 1: Deploying the Backend on AWS EC2

Since your backend consists of multiple Node.js applications and Redis, deploying them using **Docker Compose** on an AWS EC2 instance is the most robust and maintainable approach. All your backend services already have a `Dockerfile` set up!

### Step 1.1: Launch an AWS EC2 Instance

1.  Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2.  Navigate to **EC2** -> **Instances** -> **Launch instances**.
3.  **Name**: Enter `sync-code-backend`.
4.  **AMI**: Select **Ubuntu Server 24.04 LTS** (or 22.04 LTS).
5.  **Instance Type**: Choose `t3.micro` (Free tier eligible, but `t3.small` is recommended if you have memory constraints during builds).
6.  **Key Pair**: Create a new key pair or use your existing one (e.g., `sync-key.pem`).
7.  **Network Settings**: Allow SSH traffic, HTTP, and HTTPS traffic.
8.  Click **Launch instance**.

### Step 1.2: Connect to your Instance & Install Docker

1.  Open your terminal in the directory where your `sync-key.pem` is located.
2.  Connect to your instance (replace `<EC2_PUBLIC_IP>` with your instance's IPv4 address):
    ```bash
    chmod 400 sync-key.pem.pem
    ssh -i "sync-key.pem.pem" ubuntu@<EC2_PUBLIC_IP>
    ```
3.  Once connected, install Docker and Docker Compose:
    ```bash
    sudo apt update
    sudo apt install docker.io docker-compose -y
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    ```
    > [!NOTE]
    > You may need to disconnect and reconnect (`exit` and re-SSH) for the `docker` group changes to take effect.

### Step 1.3: Clone the Repository and Set Up Environment Variables

1.  Clone your repository on the EC2 instance:
    ```bash
    git clone <YOUR_GITHUB_REPO_URL> sync-code
    cd sync-code
    ```
2.  Create a root `docker-compose.yml` file to orchestrate all services. Create the file using `nano docker-compose.yml`:
    ```yaml
    version: '3.8'

    services:
      redis:
        image: redis:alpine
        ports:
          - "6379:6379"

      express-server:
        build:
          context: ./apps/express-server
        ports:
          - "3000:3000"
        environment:
          - REDIS_URL=redis://redis:6379
          - PORT=3000
        depends_on:
          - redis

      websocket-server:
        build:
          context: ./apps/websocket-server
        ports:
          - "5000:5000"
          - "5001:5001"
        environment:
          - REDIS_URL=redis://redis:6379
          - PORT=5000
        depends_on:
          - redis

      worker:
        build:
          context: ./apps/worker
        environment:
          - REDIS_URL=redis://redis:6379
        depends_on:
          - redis
    ```
3.  If you have other `.env` variables (e.g., AI API keys), add an `.env` file or include them in the `environment` blocks above.

### Step 1.4: Build and Run the Backend

1.  Start the services in detached mode:
    ```bash
    docker-compose up -d --build
    ```
2.  Verify the containers are running:
    ```bash
    docker-compose ps
    ```
    You should see `redis`, `express-server`, `websocket-server`, and `worker` in the "Up" state.

### Step 1.5: Open Required Ports in AWS Security Group

Your EC2 instance firewall needs to allow traffic to the specific ports your application uses.
1. Go to your EC2 instance in the AWS Console.
2. Click the **Security** tab, then click the associated Security Group.
3. Edit **Inbound Rules** and add the following Custom TCP rules:
   - Port `3000` (Anywhere IPv4 - `0.0.0.0/0`) -> Express API
   - Port `5000` (Anywhere IPv4 - `0.0.0.0/0`) -> WebSocket Connection
   - Port `5001` (Anywhere IPv4 - `0.0.0.0/0`) -> YJS WebSocket Connection

> [!TIP]
> For production, it's highly recommended to set up a reverse proxy (like Nginx or Caddy) to route traffic through ports 80/443 with SSL/TLS certificates, rather than exposing ports 3000, 5000, and 5001 directly.

---

## Part 2: Deploying the Frontend on Vercel

Since your project is a Turborepo and the frontend is a Vite + React app, Vercel makes this process incredibly simple.

### Step 2.1: Prepare Environment Variables for Production

Before deploying the frontend, make sure your Vite app fetches from the production AWS IP rather than `localhost`. 
In your `apps/frontend/.env` (or whatever mechanism you use), you will need to point your fetch URLs and WebSocket URLs to your EC2 Public IP or domain name:

- API URL: `http://<EC2_PUBLIC_IP>:3000`
- WS URL: `ws://<EC2_PUBLIC_IP>:5000`
- YJS WS URL: `ws://<EC2_PUBLIC_IP>:5001`

### Step 2.2: Deploy via Vercel Dashboard

1.  Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2.  Import your GitHub repository containing the `SYNC-CODE` project.
3.  Vercel should automatically detect that this is a **Turborepo**. 
4.  Configure the Build Settings for the `frontend`:
    *   **Root Directory**: Click "Edit" and select `apps/frontend`.
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Build Command**: `npm run build` or `turbo run build --filter=frontend`
    *   **Output Directory**: `dist`
5.  Open the **Environment Variables** section and add any frontend `.env` keys (e.g., your backend EC2 IPs defined in step 2.1).
6.  Click **Deploy**.

> [!IMPORTANT]
> If your frontend deployment throws mixed-content errors (`HTTPS` frontend trying to fetch from `HTTP` backend), you MUST configure SSL/TLS on your EC2 instance (using an Nginx reverse proxy + Certbot) so that your backend is accessible via `https://` and `wss://`.

### Step 2.3: Verify Deployment

1. Once Vercel finishes the build, click the Visit button to go to your live frontend application.
2. Open the network tab in Developer Tools (F12) to ensure it is successfully talking to your Express API on AWS and that the WebSocket connection successfully establishes.



Viewed deployment_guide.md:1-159
Searched for "nginx|certbot|ssl|https|wss"
Viewed README.md:845-920

Here's the complete breakdown of how **Nginx + Certbot** work together in this project:

---

## The Core Problem They Solve

The frontend is deployed on **Vercel (HTTPS)** but the backend runs on **EC2 (HTTP)**. Browsers block **mixed-content** — an HTTPS page cannot connect to HTTP/WS endpoints. So the backend must also be accessible over `https://` and `wss://`.

---

## How Nginx + Certbot Work Together

### 1. Certbot — Gets the Free SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Issue a certificate for your domain
sudo certbot --nginx -d yourdomain.com
```

- Certbot talks to **Let's Encrypt** (a free CA)
- Gets a signed SSL certificate for your domain
- **Automatically edits the Nginx config** to enable HTTPS on port 443
- Auto-renews every 90 days via a cron job

---

### 2. Nginx — Acts as the Single Entry Point (Reverse Proxy)

Instead of exposing raw ports `3000`, `5000`, `5001` to the internet, **Nginx sits in front** and routes via URL paths:

```
Browser (HTTPS/WSS)
        │
        ▼
  Nginx (Port 443) ← SSL terminated here by Certbot
        │
        ├── /api/*   ──────► Express Server  (Port 3000)
        ├── /ws/*    ──────► WebSocket Server (Port 5000)
        └── /yjs/*   ──────► Yjs WS Server   (Port 5001)
```

**Nginx config looks like this:**

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # SSL certs from Certbot
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # REST API → Express (port 3000)
    location /api/ {
        proxy_pass http://localhost:3000/;
    }

    # WebSocket → WS Server (port 5000)
    location /ws/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # ← critical for WS upgrade
    }

    # Yjs CRDT Sync → Yjs Server (port 5001)
    location /yjs/ {
        proxy_pass http://localhost:5001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

## The WebSocket Upgrade — Key Detail

HTTP → WebSocket requires an **"Upgrade"** handshake. Nginx must explicitly pass these headers, otherwise WebSocket connections silently fail:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;     # tells upstream to upgrade
proxy_set_header Connection "upgrade";      # keeps connection alive
```

This is why `ws://` becomes `wss://` — Nginx handles the TLS layer, then internally proxies as plain `ws://` to Docker containers.

---

## Summary

| Component | Role |
|---|---|
| **Certbot** | Gets free SSL cert from Let's Encrypt, auto-renews it |
| **Nginx** | Terminates SSL, routes `https://` → internal ports, upgrades `wss://` connections |
| **EC2 Security Group** | Only ports `80` & `443` open publicly (not 3000/5000/5001) |
| **Docker containers** | Only listen on `localhost` — never exposed directly to internet |
