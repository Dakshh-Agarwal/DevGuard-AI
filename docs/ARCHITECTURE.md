# Architecture

## Architecture

```mermaid
graph TD
    Browser["Browser - React 19 + Vite"]
    CloudFront["CloudFront CDN + S3"]
    Backend["Express 5 Backend - Node.js 20 on EC2"]
    Supabase["Supabase - PostgreSQL + Auth"]
    Gemini["Google Gemini API\ngemini-2.5-flash / 2.5-pro / 2.0-flash-lite"]
    StaticTools["Static Analyzers\nPylint · Checkstyle · Tree-sitter · Custom JS rules"]
    Prometheus["Prometheus v2.53 - 30d retention"]
    Loki["Loki v2.9 - Log aggregation"]
    Promtail["Promtail v2.9 - Docker log shipper"]
    Grafana["Grafana v10.4 - 16-panel dashboard"]

    Browser -->|HTTPS| CloudFront
    CloudFront -->|serves static assets| Browser
    Browser -->|REST API calls| Backend
    Backend -->|JWT verify / queries| Supabase
    Backend -->|AI review prompt| Gemini
    Backend -->|subprocess / AST parse| StaticTools
    Backend -->|scrape every 15s| Prometheus
    Backend -->|structured JSON logs| Loki
    Promtail -->|Docker container logs backup| Loki
    Prometheus -->|datasource| Grafana
    Loki -->|datasource| Grafana
```

### API Data Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Express
    participant Supabase as Auth & DB
    participant Pipeline as AI Pipeline
    participant Static as Static Analysis
    
    Browser->>Express: POST /api/analyze/multi (Code payload)
    Express->>Supabase: verifyToken() & getProfile()
    Supabase-->>Express: user_id + role
    
    par Analysis Engines
        Express->>Pipeline: Invoke Gemini (with retry/fallback)
        Pipeline-->>Express: AI Suggestions (JSON)
    and
        Express->>Static: Spawn linters / parse AST
        Static-->>Express: Static Suggestions (JSON)
    end
    
    Express->>Express: Merge & deduplicate results
    Express-->>Browser: Final Suggestions (HTTP 200)
```

### Request Lifecycle

Every HTTP request passes through this middleware chain before reaching a route handler:

```
Incoming request
    â”‚
    â–¼
requestContextMiddleware    â”€â”€ generates UUID request_id, sets up AsyncLocalStorage
    â”‚
    â–¼
metricsMiddleware           â”€â”€ increments active gauge, starts hrtime timer
    â”‚
    â–¼
CORS middleware             â”€â”€ allowlist: devguard.dakshagarwal.dev, CloudFront, localhost
    â”‚
    â–¼
express.json()              â”€â”€ body parsing
    â”‚
    â–¼
Route handler
    â”‚
    â”œâ”€â”€ verifyUserToken (protected routes)
    â”‚       â””â”€â”€ supabase.auth.getUser(token)
    â”‚               â””â”€â”€ setRequestUserId() â†’ writes user_id into AsyncLocalStorage
    â”‚
    â”œâ”€â”€ Business logic / AI pipeline / static analysis
    â”‚
    â””â”€â”€ Response
            â”‚
            â–¼
    res.on('finish')
    metricsMiddleware records: httpRequestsTotal, httpRequestDuration, httpActiveRequests.dec()
```

---

## AI Review Pipeline

```mermaid
flowchart TD
    A["POST /api/analyze"] --> B["Fetch rejection history from Supabase"]
    B --> C["Run language-specific static analyzer"]
    C --> D["Build Gemini prompt with rejection notes + static context"]
    D --> E{"Try gemini-2.5-flash\n3 attempts x 45s timeout"}
    E -->|success| H
    E -->|all fail| F{"Try gemini-2.5-pro\n3 attempts x 45s timeout"}
    F -->|success| H
    F -->|all fail| G{"Try gemini-2.0-flash-lite\n3 attempts x 45s timeout"}
    G -->|success| H
    G -->|all fail| I["Return fallback response with generic suggestions"]
    H["Parse JSON response, filter rejected lines, normalize suggestions"]
    H --> J["Merge static + Gemini suggestions"]
    J --> K["Return to client"]
```

### Model Selection and Retry Logic

The review function iterates through three Gemini models. For each model, up to three calls are attempted with exponential backoff (2 s â†’ 4 s â†’ 8 s). Each call is wrapped in a `Promise.race` with a 45-second timeout to prevent the server from hanging on a degraded API.

```
gemini-2.5-flash      â†’ 3 attempts Ã— 45s timeout each
         ↓ if all fail
gemini-2.5-pro        â†’ 3 attempts Ã— 45s timeout each
         ↓ if all fail
gemini-2.0-flash-lite â†’ 3 attempts Ã— 45s timeout each
         ↓ if all fail
Fallback response returned — never throws an error to the client
```

### JSON Enforcement

All prompts use `responseMimeType: "application/json"`. If the response does not begin with `{`, a second strict-mode prompt is sent automatically to extract valid JSON before the result is returned. This prevents markdown-wrapped responses or commentary from reaching the JSON parser.

### Rejection Feedback Loop

When a user rejects a suggestion, the decision is stored in the `feedback` table. On the next analysis of the same code, the backend queries past rejections and injects them into the Gemini prompt:

```
Don't repeat these rejected suggestions for non-critical issues:
1. "Use let instead of var"
Don't give style or best-practice suggestions on lines: [14, 22]
```

Critical types (`syntax`, `logical`, `semantic`) are always reported, regardless of rejection history.

### Multi-File Context

For multi-file submissions, each file is reviewed with additional prompt context:
- Total file count and languages across the project
- Summaries of up to 5 sibling files (name, language, line count) to avoid token overflow
- A cross-file instruction set focused on architecture patterns, coupling, duplication, and security vectors that span files

---

## Static Analysis Engines

### Python — Pylint

Submitted code is written to a temp file and `analyze_python.py` is invoked as a subprocess. The script runs Pylint with its JSON reporter and returns structured diagnostics. The temp file is deleted in a `finally` block regardless of outcome. Execution time is recorded in the `devguard_pylint_duration_seconds` histogram.

### JavaScript — Custom Rule Engine

`analyzeJS.js` scans each line with regex patterns for:
- `console.log` calls left in production code
- `var` declarations (recommends `let` or `const`)
- Empty `catch` blocks

Runs in-process with nanosecond-precision timing via `process.hrtime.bigint()`.

### Java — Checkstyle

Checkstyle is invoked via `child_process.exec()` using the Google Java Style XML configuration. Output is parsed line by line, filtered to the submitted file's basename, and returned as structured suggestions. Execution time is recorded in `devguard_checkstyle_duration_seconds`.

### C / C++ — Tree-sitter

`node-tree-sitter` parses the submitted code into a concrete syntax tree using the CPP grammar. A recursive AST walker flags:
- Function definitions (structural inventory)
- Variable declarations without initialization
- Functions longer than 15 lines (refactoring candidate)
- Standalone `void` return types

Timing is recorded in `devguard_treesitter_duration_seconds`.

---
