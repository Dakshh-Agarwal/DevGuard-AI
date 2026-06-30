<div align="center">

# DevGuard-AI

**AI-powered code review platform with multi-language static analysis, team collaboration, and production-grade observability.**

[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Prometheus](https://img.shields.io/badge/Prometheus-2.53-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-10.4-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![Loki](https://img.shields.io/badge/Loki-2.9-F7941E?logo=grafana&logoColor=white)](https://grafana.com/oss/loki/)
[![Gemini](https://img.shields.io/badge/Google-Gemini%20AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

[**Live Demo**](https://devguard.dakshagarwal.dev) &nbsp;·&nbsp; [Report a Bug](https://github.com/Dakshh-Agarwal/DevGuard-AI/issues) &nbsp;·&nbsp; [Contribute](CONTRIBUTING.md)

</div>

---

> **The Problem:** Code reviews are a massive bottleneck. Senior engineers waste countless hours catching syntax errors, anti-patterns, and basic security vulnerabilities instead of focusing on architecture. Meanwhile, traditional static analysis tools lack the context to understand business logic, resulting in noisy, unhelpful alerts that developers ignore.
> 
> **The Solution:** DevGuard-AI acts as your untiring Principal Engineer. It intelligently merges deterministic static analysis (Pylint, Checkstyle, Tree-sitter) with the deep contextual understanding of Google Gemini to catch **security vulnerabilities**, structural flaws, and logic errors in seconds. Best of all, it features **adaptive learning**—the AI pipeline learns from your team's rejected feedback, ensuring it never bothers you with the same useless suggestion twice.

---

<div align="center">

| Metric | Value |
|---|---:|
| **Languages Supported** | 5 |
| **Docker Containers** | 5 |
| **REST Endpoints** | 23+ |
| **Custom Prometheus Metrics** | 20 |
| **Grafana Dashboard Panels** | 16 |
| **Runtime Validation Tests** | 57 |
| **Load Tested** | 30k reqs |
| **AI Models (Gemini)** | 3 |
| **Static Analyzers** | 4 |

</div>

---

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Landing Page</strong></td>
    <td align="center"><strong>Code Editor</strong></td>
  </tr>
  <tr>
    <td><img src="docs/Images/Homepage.jpg" alt="Landing Page" width="450"/></td>
    <td><img src="docs/Images/Code_editor.jpg" alt="Code Editor" width="450"/></td>
  </tr>
  <tr>
    <td align="center"><strong>GitHub Integration</strong></td>
    <td align="center"><strong>Team Collaboration</strong></td>
  </tr>
  <tr>
    <td><img src="docs/Images/GithubIntegration.jpg" alt="GitHub Integration" width="450"/></td>
    <td><img src="docs/Images/Collabration.jpg" alt="Team Collaboration" width="450"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Admin Dashboard</strong></td>
    <td align="center"><strong>Team Management</strong></td>
  </tr>
  <tr>
    <td><img src="docs/Images/Admin_DashBoard.jpg" alt="Admin Dashboard" width="450"/></td>
    <td><img src="docs/Images/Team.jpg" alt="Team Management" width="450"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Grafana — Observability Dashboard (Top)</strong></td>
    <td align="center"><strong>Grafana — Observability Dashboard (Bottom)</strong></td>
  </tr>
  <tr>
    <td><img src="docs/Images/Grafnaa_1.png" alt="Grafana Dashboard Top" width="450"/></td>
    <td><img src="docs/Images/Grafna-2.png" alt="Grafana Dashboard Bottom" width="450"/></td>
  </tr>
</table>

---

## Documentation

This README provides a high-level overview. For deep technical details, refer to the `docs/` directory:

- 📊 **[Monitoring & Observability](docs/MONITORING.md)** — Prometheus, Loki, Grafana, runtime validation
- 🏗️ **[Architecture & Pipeline](docs/ARCHITECTURE.md)** — AI fallback chain, static analysis, request flow
- 🔌 **[API Reference](docs/API.md)** — REST endpoints, JSON schemas, authentication
- 🚀 **[Deployment & Environment](docs/DEPLOYMENT.md)** — EC2, Docker Compose, environment variables
- 🔒 **[Security & Authentication](docs/SECURITY.md)** — JWT, OAuth, RBAC, log sanitization

---

## Design Principles

- **Reliability before convenience** — Extensive fallback chains and retries for external APIs.
- **Observability by default** — If a route isn't instrumented, it doesn't ship.
- **Secure-by-default APIs** — Mandatory server-side token verification and zero-trust parameter handling.
- **Structured logging** — Winston JSON logs ready for Loki stream ingestion.
- **Fail gracefully** — 45-second timeouts protect the Express event loop from degrading upstream services.
- **Production-first development** — Built with real-world infrastructure constraints in mind.

---

## Component Architecture

DevGuard-AI is designed with clear boundaries between the frontend application, the routing layer, the analysis orchestration, and the observability stack.

```mermaid
flowchart TD
    Browser["🌐 Browser"]
    React["⚛️ React (Vite)"]
    Express["🚀 Express Backend"]
    Orchestrator["🧠 Analysis Orchestrator"]
    Static["🔍 Static Analysis\n(Tree-sitter, Pylint)"]
    Gemini["🤖 Google Gemini\n(Flash, Pro, Lite)"]
    Merge["🔄 Merge & Deduplicate"]
    Feedback["💾 Supabase (PostgreSQL)"]
    Observability["📊 Metrics + Logs\n(Prometheus / Loki)"]

    Browser --> React
    React -->|HTTPS| Express
    Express --> Orchestrator
    
    Orchestrator --> Static
    Orchestrator --> Gemini
    
    Static --> Merge
    Gemini --> Merge
    
    Merge --> Feedback
    Feedback --> React
    
    Express -.->|AsyncLocalStorage Tracing| Observability
```

---

## Deployment Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | AWS S3 + CloudFront CDN | Globally distributed static hosting |
| **Backend** | AWS EC2 (Ubuntu) + Docker Compose | Containerized Node.js backend and monitoring services |
| **Backend HTTPS** | Dedicated CloudFront distribution | Proxying HTTPS requests to the EC2 backend |
| **TLS/SSL** | AWS Certificate Manager (ACM) | Public certificate attached to CloudFront with TLS 1.3 |
| **Database & Authentication** | Supabase (PostgreSQL + Auth) | Managed database and auth layer |
| **Observability** | Prometheus + Loki + Grafana | Metrics, logs, dashboards |
| **Process Management** | PM2 | Process supervision and automatic restarts |
| **Networking** | AWS Elastic IP | Stable backend connectivity |
| **Memory Protection** | 1.5 GB swap file | Prevents OOM crashes on the t3.micro instance |
| **Region** | AWS ap-south-2 (Hyderabad) | Low-latency for Indian users |

> For detailed deployment architecture, environment variables, and Docker setup, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```mermaid
flowchart TD
    Internet["Internet"] --> DNS["Cloudflare DNS"]
    
    DNS --> CFF["CloudFront\n(Frontend)"]
    DNS --> CFB["CloudFront\n(Backend Proxy)"]
    
    CFF --> S3["AWS S3"]
    CFB --> EC2["AWS EC2 (Ubuntu)"]
    
    EC2 --> Docker["Docker Compose"]
    
    Docker --> Backend["Backend"]
    Docker --> Prometheus["Prometheus"]
    Docker --> Loki["Loki"]
    Docker --> Grafana["Grafana"]
    
    Backend --> Supabase["Supabase (DB/Auth)"]
```

---

## Engineering Highlights

- **Adaptive Learning Pipeline** — The system learns from user rejections, injecting negative feedback into future Gemini prompts to prevent repeating unwanted suggestions.
- **Security & Context-Aware AI** — Merges static AST parsing with LLM context to find logic and security flaws standard linters miss.
- **Multi-model Gemini fallback** — Resilient AI pipeline with exponential backoff and strict JSON enforcement.
- **Structured JSON logging** — Optimized for fast LogQL queries and automated dashboarding.
- **Production observability** — Comprehensive instrumentation of HTTP, DB, AI, and static analysis layers.
- **Runtime validation framework** — Bespoke test suite that executes actual PromQL/LogQL queries against the live stack.
- **Dockerized monitoring stack** — Prometheus, Loki, Promtail, and Grafana auto-provisioned with custom dashboards.
- **Team collaboration architecture** — Role-based access control with distinct peer and code review flows.

> [!TIP]
> **💡 Why AsyncLocalStorage?**
>
> Passing `request_id` manually through every single function call (from routes to AI clients to database helpers) creates tightly coupled, messy code. 
> 
> By utilizing `AsyncLocalStorage`, DevGuard-AI keeps the request context available throughout the entire asynchronous execution lifetime without changing function signatures. The Winston logger automatically extracts this context and injects tracing metadata invisibly into every log line.

> [!TIP]
> **💡 Why `dynamicLabels: false` for Loki?**
>
> Naively logging `request_id` as a label in Loki causes stream explosion (Loki limits streams to 10k by default), quickly crashing the server in production.
>
> We disabled dynamic labels in the Winston-Loki transport. Only the `service` name is sent as a stream label. The `request_id` and `user_id` are serialized into the JSON payload, making them queryable via LogQL (`| json | request_id="..."`) without generating memory-crashing streams.

---

## Runtime Validation

> [!IMPORTANT]
> **Production-Ready & Load Tested**
>
> Built for scale, DevGuard-AI has been rigorously load-tested using `autocannon` to handle **30,000+ requests** (sustained 3,000+ req/s) without dropping connections or degrading the event loop. The monitoring stack is automatically validated using a custom 7-phase runtime validation suite that executes live queries and traffic to verify:
> * Backend & API health
> * Prometheus scrape targets
> * Grafana datasource provisioning
> * 14 Prometheus dashboard queries
> * 4 Loki LogQL queries
> * Structured JSON log schema and secret sanitization

---

## Challenges & Solutions

| Challenge | Solution |
|---|---|
| **Gemini JSON responses** | Enforced JSON mode with automatic retry + strict fallback parsing |
| **Loki label explosion** | Disabled dynamic labels; injected metadata into JSON payload instead |
| **Long-running AI requests** | Multi-model fallback chain with aggressive 45s timeouts |
| **Multi-file overload** | Serialized memory queue with queue-depth Prometheus metrics |
| **Observability validation** | Built a 7-phase runtime verification script hitting real endpoints |

---

## Engineering Journey

- **Phase 1:** Single file AI review
- **Phase 2:** Multi-language support (Pylint, Checkstyle, Tree-sitter)
- **Phase 3:** GitHub Integration (OAuth & Repository browsing)
- **Phase 4:** Teams (Role-based access & Dashboard Analytics)
- **Phase 5:** Observability (Prometheus, Loki, Grafana)
- **Phase 6:** Production Deployment & Runtime Validation

---

## Future Improvements & Limitations

**What DevGuard-AI is not:**
- It does not execute submitted code.
- It does not run tests.
- It does not connect directly to CI/CD pipelines (yet).
- Analysis is performed by reading source text, not by running it.

**Planned Improvements:**
- Rate limiting on analysis endpoints to prevent abuse.
- Result caching — identical code + language could skip redundant Gemini calls.
- Webhook integration — trigger analysis directly from GitHub pull request events.

---

## License

ISC License — see repository root for details.

---

<div align="center">

Built with Node.js &nbsp;·&nbsp; React &nbsp;·&nbsp; Google Gemini &nbsp;·&nbsp; Supabase &nbsp;·&nbsp; Prometheus &nbsp;·&nbsp; Grafana &nbsp;·&nbsp; Loki

</div>