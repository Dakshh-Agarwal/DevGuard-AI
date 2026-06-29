# Deployment & Environment

## Deployment Architecture

```
Internet
    â”‚
    â–¼
Amazon CloudFront (CDN)
    â”‚
    â”œâ”€â”€ Static assets (JS, CSS, images) â”€â”€â”€ Amazon S3
    â”‚
    â””â”€â”€ /api/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ EC2 Instance (Ubuntu)
                                                â”‚
                                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                    â”‚   Docker network:         â”‚
                                    â”‚   devguard-network        â”‚
                                    â”‚                           â”‚
                                    â”‚  devguard-backend   :5000 â”‚
                                    â”‚  devguard-prometheus :9090â”‚
                                    â”‚  devguard-loki      :3100 â”‚
                                    â”‚  devguard-promtail        â”‚
                                    â”‚  devguard-grafana   :3001 â”‚
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                â”‚
                                    Named Docker volumes (persistent):
                                    prometheus-data, loki-data, grafana-data
```

All 5 containers share the `devguard-network` bridge network and communicate by service name (e.g., `http://loki:3100`). Named Docker volumes persist Prometheus data, Loki chunks, and Grafana state across container restarts and redeployments.

The backend Dockerfile includes a Docker health check: `wget --spider --quiet http://localhost:5000/health` every 30 seconds. After 3 consecutive failures Docker marks the container `unhealthy`.

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3 + pip (for Pylint)
- Java 11+ (for Checkstyle — optional)
- Docker + Docker Compose (for the monitoring stack — optional)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Dakshh-Agarwal/DevGuard-AI.git
cd DevGuard-AI

# 2. Configure backend environment
cp server/.env.example server/.env
# Edit server/.env — fill in GEMINI_API_KEY, SUPABASE_*, GITHUB_CLIENT_*

# 3. Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Running

Open three terminals:

**Terminal 1 — Backend:**
```bash
cd server
node index.js
# Server starts at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Vite dev server starts at http://localhost:5173
```

**Terminal 3 — Monitoring stack (optional):**
```bash
docker compose up -d prometheus loki promtail grafana
# Grafana: http://localhost:3001 (admin / admin)
# Prometheus: http://localhost:9090
```

> If `LOKI_URL` is not set in `server/.env`, Winston logs to console only and the Loki transport is silently skipped. The monitoring stack is entirely optional during local development.

---

## Docker Setup

The full application stack (backend + monitoring) is defined in `docker-compose.yml`. The frontend is deployed separately to CloudFront/S3.

```bash
# Start all 5 services
docker compose up -d

# Rebuild backend after code changes
docker compose build --no-cache devguard-backend
docker compose up -d --no-deps devguard-backend

# Tail backend logs
docker compose logs -f devguard-backend

# Check container statuses
docker compose ps
```

Expected healthy state:
```
Name                    State          Ports
devguard-backend    Up (healthy)   0.0.0.0:5000->5000/tcp
devguard-grafana    Up             0.0.0.0:3001->3000/tcp
devguard-loki       Up             0.0.0.0:3100->3100/tcp
devguard-prometheus Up             0.0.0.0:9090->9090/tcp
devguard-promtail   Up
```

---

## Environment Variables

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Express server port (default: `5000`) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key — [get one here](https://ai.google.dev/) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (required for admin user lookups) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `VITE_FRONTEND_URL` | Yes | Frontend base URL (used when generating team join links) |
| `LOKI_URL` | Optional | Loki push endpoint. Set to `http://loki:3100` in Docker |
| `METRICS_USER` | Optional | Basic auth username for `/metrics` (default: `admin`) |
| `METRICS_PASS` | Optional | Basic auth password for `/metrics` (default: `devguard-metrics`) |
| `LOG_LEVEL` | Optional | Winston log level: `error` / `warn` / `info` / `debug` (default: `info`) |

### Frontend (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Backend API base URL (e.g., `http://localhost:5000`) |
| `VITE_GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID (must match the backend value) |

---

## Production Deployment

### Initial EC2 setup

```bash
ssh -i your-key.pem ubuntu@<ec2-ip>

git clone https://github.com/Dakshh-Agarwal/DevGuard-AI.git
cd DevGuard-AI

cp server/.env.example server/.env
nano server/.env   # fill in all required values

docker compose build --no-cache devguard-backend
docker compose up -d

docker compose ps
docker logs devguard-backend --tail 50
```

### Updating a running deployment

```bash
cd DevGuard-AI
git pull origin main

# Rebuild only the backend — other services are unaffected
docker compose build --no-cache devguard-backend
docker compose up -d --no-deps devguard-backend
docker compose ps
```

---
