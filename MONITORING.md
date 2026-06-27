# DevGuard-AI — Monitoring & Observability Guide

## Quick Access

| Service | URL | Credentials |
|---|---|---|
| **Grafana** | http://localhost:3001 | `admin` / `admin` |
| **Prometheus** | http://localhost:9090 | — |
| **Metrics endpoint** | http://localhost:5000/metrics | `admin` / `devguard-metrics` |
| **Loki** | http://localhost:3100 | — |

---

## Starting the Observability Stack

```bash
docker-compose up -d
```

This starts 5 services: backend, Prometheus, Loki, Promtail, and Grafana. The Grafana dashboard is auto-provisioned — no manual setup required.

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

Use the structured logger — never `console.log`:

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

The `request_id` and `user_id` are automatically injected by the logger — no need to pass them.

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
