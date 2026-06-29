# Monitoring & Observability

## Monitoring and Observability

### Request Tracing with AsyncLocalStorage

Node.js `AsyncLocalStorage` (from `async_hooks`) propagates context across asynchronous boundaries without threading parameters through every function call.

At the start of each request, `requestContextMiddleware` creates a store containing `{ request_id, user_id }` and runs the rest of the request inside it via `asyncLocalStorage.run(store, () => next())`. Any code downstream â€” including utility functions, the Gemini client, and Supabase helpers â€” calls `getRequestContext()` to retrieve these values. The Winston logger injects them into every log line as a custom format step.

```javascript
// Deep inside geminiReview.js â€” request_id flows in automatically
logger.info('Gemini succeeded with gemini-2.5-flash', {
  model: 'gemini-2.5-flash',
  duration_sec: '2.341',
  context: 'gemini.success',
  // request_id and user_id are injected automatically â€” never passed explicitly
});
```

Trace a full request in Loki:
```logql
{service="devguard-backend"} | json | request_id = "a1b2c3d4"
```

---

### Prometheus Metrics

There are **20 custom application metrics** registered under the `devguard_` namespace, plus all default Node.js runtime metrics collected via `client.collectDefaultMetrics()`. The `/metrics` endpoint requires HTTP Basic Authentication (`admin` / `devguard-metrics` by default, configurable via env vars). The runtime validation script (Phase 6) confirms that 18 of these metric names are present in the raw `/metrics` output immediately after startup, before any analysis requests are made.

#### HTTP Layer

| Metric | Type | Labels | Description |
|---|---|---|---|
| `devguard_http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests |
| `devguard_http_request_duration_seconds` | Histogram | `method`, `route` | Latency (buckets: 10msâ€“60s) |
| `devguard_http_active_requests` | Gauge | â€” | In-flight requests at any instant |

Route labels are normalized to prevent cardinality explosion: `/api/teams/abc-123/members` becomes `/api/teams/:id/members`.

#### Gemini AI

| Metric | Type | Labels | Description |
|---|---|---|---|
| `devguard_gemini_calls_total` | Counter | `model`, `status` | Calls per model: success / failure / fallback |
| `devguard_gemini_duration_seconds` | Histogram | `model` | Response latency per model (buckets: 500msâ€“120s) |
| `devguard_gemini_retries_total` | Counter | `model` | Retry attempts per model |
| `devguard_gemini_json_parse_errors_total` | Counter | â€” | Gemini JSON parse failures |

All three model names (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash-lite`) are zero-initialized at startup so Prometheus `rate()` functions work from the first event.

#### Review Pipeline

| Metric | Type | Labels | Description |
|---|---|---|---|
| `devguard_reviews_submitted_total` | Counter | `type` (single/multi) | Reviews submitted |
| `devguard_reviews_completed_total` | Counter | `type`, `status` | Reviews completed by outcome |
| `devguard_review_duration_seconds` | Histogram | `type`, `language` | End-to-end review time (buckets: 500msâ€“300s) |
| `devguard_review_issues_total` | Histogram | `language`, `source` | Issues found per review (static vs gemini) |
| `devguard_review_queue_size` | Gauge | â€” | Multi-file queue depth |

#### Static Analysis Tools

| Metric | Type | Description |
|---|---|---|
| `devguard_pylint_duration_seconds` | Histogram | Pylint subprocess execution time |
| `devguard_treesitter_duration_seconds` | Histogram | Tree-sitter parse time |
| `devguard_checkstyle_duration_seconds` | Histogram | Checkstyle subprocess execution time |
| `devguard_static_analysis_errors_total` | Counter | Tool failures, labeled by `tool` |

#### Auth, Database, and Feedback

| Metric | Type | Labels | Description |
|---|---|---|---|
| `devguard_oauth_attempts_total` | Counter | `status` | GitHub OAuth: success / failure / duplicate |
| `devguard_supabase_query_duration_seconds` | Histogram | `table`, `operation` | Database query latency |
| `devguard_supabase_errors_total` | Counter | `table`, `operation` | Database errors |
| `devguard_feedback_decisions_total` | Counter | `decision`, `suggestion_type` | Accept/reject counts |

All standard Node.js runtime metrics (heap, event loop lag, GC) are collected under the `devguard_` prefix via `client.collectDefaultMetrics()`.

---

### Loki Logging

Logs are batched and flushed to Loki every 5 seconds via `winston-loki`.

**Key implementation decisions:**

- `dynamicLabels: false` â€” Only the static label `service: "devguard-backend"` is sent to Loki. If dynamic labels were enabled, every `request_id`, `user_id`, and `model` value would create a new Loki stream, exhausting Loki's default 10,000-stream limit and causing out-of-memory crashes in production.
- `json: false` with `format: winston.format.json()` â€” Winston pre-formats the payload as valid JSON before `winston-loki` sends it. This prevents the double-encoding bug that causes `JSONParserErr` in Grafana's `| json` pipeline.
- **Sensitive field redaction** â€” Any metadata key containing `password`, `token`, `access_token`, `api_key`, `apikey`, `secret`, `client_secret`, `cookie`, or `authorization` is replaced with `[REDACTED]` before emission.

**Structured log format:**
```json
{
  "timestamp": "2026-06-29 15:12:49.165",
  "level": "info",
  "message": "Single-file review completed",
  "service": "devguard-backend",
  "request_id": "a1b2c3d4-e5f6-...",
  "user_id": "7890abcd-...",
  "language": "python",
  "suggestionsCount": 7,
  "duration_sec": "4.213",
  "context": "analyze.single"
}
```

**Common LogQL queries** (via Grafana Explore at `http://localhost:3001`):

```logql
# All error logs
{service="devguard-backend"} | json | level = "error"

# Trace a single request end-to-end
{service="devguard-backend"} | json | request_id = "a1b2c3d4"

# Slow reviews (> 10 seconds)
{service="devguard-backend"} | json | context = "analyze.single" | duration_sec > 10

# Gemini model failures
{service="devguard-backend"} | json | context = "gemini.failure"

# GitHub OAuth events
{service="devguard-backend"} | json | context = "github.oauth"

# Error rate by context over 5 minutes
sum by(context) (count_over_time({service="devguard-backend"} | json | level = "error" [5m]))
```

See [MONITORING.md](MONITORING.md) for additional queries, troubleshooting steps, and instructions for adding new log events.

---

### Grafana Dashboard

The dashboard is auto-provisioned from `monitoring/grafana/provisioning/dashboards/devguard.json`. Datasources are auto-provisioned from `datasources.yml`. No manual Grafana setup is required after `docker compose up -d`.

**16 panels** (verified from `monitoring/grafana/provisioning/dashboards/devguard.json`, in dashboard order):

| # | Panel title | Type |
|---|---|---|
| 1 | Request Rate (req/s) | Time series |
| 2 | Error Rate (4xx / 5xx) | Time series |
| 3 | Active Requests | Gauge |
| 4 | Latency p50 / p95 / p99 per Route | Time series |
| 5 | Gemini API Call Rate & Latency | Time series |
| 6 | Gemini Failure Rate | Stat |
| 7 | Issues Flagged per Review (avg) | Stat |
| 8 | OAuth Login Success / Failure | Stat |
| 9 | Average Review Latency | Gauge |
| 10 | Review Pipeline: Submission / Completion / Failure Rate | Time series |
| 11 | Pylint + Tree-sitter + Checkstyle Execution Time | Time series |
| 12 | Feedback Accept vs Reject | Bar chart |
| 13 | Node.js Heap Usage | Time series |
| 14 | Event Loop Lag | Time series |
| 15 | Log Volume by Level (Loki) | Bar chart |
| 16 | Recent Error Logs (Last 50) | Log panel |

All panel PromQL and LogQL queries were executed and validated by `server/runtime_validation.js` Phase 4 and Phase 5.

Access Grafana at `http://localhost:3001` with credentials `admin` / `admin`.

---

## Performance Characteristics

**HTTP throughput:** ~3,000 req/s for lightweight endpoints on a single EC2 instance, as measured by the Phase 7 load test.

**Analysis latency (single file):**
- Normal conditions (Gemini API available): 2â€“6 seconds
- Rate-limited with exponential backoff (HTTP 429): 6â€“45 seconds  
- All three Gemini models failing: up to ~135 seconds before fallback (3 models Ã— 3 retries Ã— 45s timeout)

**Multi-file queue:** Only one multi-file analysis runs at a time. This prevents concurrent Gemini API saturation and keeps server resources stable. Queue depth is visible in Grafana.

**Loki batching:** Logs flush every 5 seconds, so there is up to a 5-second delay before new logs appear in Grafana's log panels.

**Prometheus scrape interval:** 15 seconds. `rate()` queries over `[5m]` windows appear flat on low-traffic deployments â€” run the load test or shorten the rate window to generate visible data.

---

---

# DevGuard-AI â€” Monitoring & Observability Guide

## Quick Access

| Service | URL | Credentials |
|---|---|---|
| **Grafana** | http://localhost:3001 | `admin` / `admin` |
| **Prometheus** | http://localhost:9090 | â€” |
| **Metrics endpoint** | http://localhost:5000/metrics | `admin` / `devguard-metrics` |
| **Loki** | http://localhost:3100 | â€” |

---

## Starting the Observability Stack

```bash
docker-compose up -d
```

This starts 5 services: backend, Prometheus, Loki, Promtail, and Grafana. The Grafana dashboard is auto-provisioned â€” no manual setup required.

---

## Dashboard Panels (16 panels)

### HTTP Layer
| Panel | Type | What it tracks |
|---|---|---|
| Request Rate (req/s) | Time Series | HTTP request rate by method (GET/POST/etc.) |
| Error Rate (4xx / 5xx) | Time Series | Client and server error rates |
| Active Requests | Gauge | In-flight requests (green/yellow/red at 0/10/50) |
| Latency p50/p95/p99 per Route | Time Series | Request latency percentiles per API route |

### Gemini AI
| Panel | Type | What it tracks |
|---|---|---|
| Gemini API Call Rate & Latency | Time Series | Call rate by model + p95 latency |
| Gemini Failure Rate | Stat | Percentage of failed Gemini calls |

### Review Pipeline
| Panel | Type | What it tracks |
|---|---|---|
| Review Pipeline Rates | Time Series | Submission, completion, and failure rates |
| Average Review Latency | Gauge | Mean end-to-end review time (thresholds: 10s/30s) |
| Issues Flagged per Review (avg) | Stat | Average issues found per review |

### Static Analysis
| Panel | Type | What it tracks |
|---|---|---|
| Pylint + Tree-sitter + Checkstyle Time | Time Series | p95 execution time for each tool |

### Auth & Feedback
| Panel | Type | What it tracks |
|---|---|---|
| OAuth Login Success/Failure | Stat | GitHub OAuth attempts by outcome |
| Feedback Accept vs Reject | Bar Chart | Cumulative accept/reject decisions |

### System Health
| Panel | Type | What it tracks |
|---|---|---|
| Node.js Heap Usage | Time Series | V8 heap used vs total |
| Event Loop Lag | Time Series | Event loop lag (mean + p99) |

### Logs (Loki)
| Panel | Type | What it tracks |
|---|---|---|
| Log Volume by Level | Bar Chart | Count of info/warn/error logs over time |
| Recent Error Logs (Last 50) | Log Panel | Live error log stream |

---

## Adding a New Metric

### Step 1: Define in `server/utils/metrics.js`

```javascript
const myNewCounter = new client.Counter({
  name: 'devguard_my_feature_total',
  help: 'Description of what this counts',
  labelNames: ['status'],
  registers: [register],
});

// Add to module.exports at the bottom
```

### Step 2: Use in your route/utility

```javascript
const { myNewCounter } = require('../utils/metrics');

// In your handler:
myNewCounter.inc({ status: 'success' });
```

### Step 3: Add a Grafana panel

Either edit `monitoring/grafana/provisioning/dashboards/devguard.json` or create panels in the Grafana UI.

Example PromQL query for a rate panel:
```
sum(rate(devguard_my_feature_total[5m])) by (status)
```

### Step 4: Verify

```bash
curl -u admin:devguard-metrics http://localhost:5000/metrics | grep my_feature
```

---

## Querying Logs in Loki (LogQL)

Access Loki logs via Grafana's Explore tab (http://localhost:3001/explore).

### Common Queries

**All error logs:**
```logql
{service="devguard-backend"} | json | level = "error"
```

**Gemini-related logs:**
```logql
{service="devguard-backend"} | json | context =~ "gemini.*"
```

**Slow reviews (>10 seconds):**
```logql
{service="devguard-backend"} | json | context = "analyze.single" | duration_sec > 10
```

**OAuth events:**
```logql
{service="devguard-backend"} | json | context = "github.oauth"
```

**Logs for a specific request:**
```logql
{service="devguard-backend"} | json | request_id = "a1b2c3d4"
```

**Error rate over time:**
```logql
sum by(context) (count_over_time({service="devguard-backend"} | json | level = "error" [5m]))
```

---

## Adding a New Log Event

Use the structured logger â€” never `console.log`:

```javascript
const logger = require('../utils/logger');

// Info level with context
logger.info('Description of what happened', {
  relevant_field: value,
  duration_sec: elapsed.toFixed(3),
  context: 'feature.action',     // Use dot notation: module.action
});

// Warning
logger.warn('Something unexpected but recoverable', {
  error: err.message,
  context: 'feature.action',
});

// Error (include stack trace)
logger.error('Something failed', {
  error: err.message,
  stack: err.stack,
  context: 'feature.action',
});
```

The `request_id` and `user_id` are automatically injected by the logger â€” no need to pass them.

---

## Troubleshooting

### Prometheus not scraping metrics
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test metrics endpoint directly
curl -u admin:devguard-metrics http://localhost:5000/metrics
```

### Loki not receiving logs
```bash
# Check Loki readiness
curl http://localhost:3100/ready

# Verify LOKI_URL env var
docker exec devguard-backend env | grep LOKI
```

### Viewing raw container logs
```bash
docker-compose logs -f devguard-backend
docker-compose logs -f prometheus
docker-compose logs -f loki
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOKI_URL` | *(none)* | Loki endpoint. Set to `http://loki:3100` in Docker |
| `METRICS_USER` | `admin` | Basic auth username for `/metrics` |
| `METRICS_PASS` | `devguard-metrics` | Basic auth password for `/metrics` |
| `LOG_LEVEL` | `info` | Winston log level (`error`, `warn`, `info`, `debug`) |

