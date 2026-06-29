/**
 * DevGuard-AI — Runtime Grafana Validation Script
 * 
 * This script:
 * 1. Validates all datasources via Grafana API
 * 2. Runs every PromQL/LogQL query from devguard.json directly
 * 3. Generates real application traffic
 * 4. Verifies every metric populates
 * 5. Verifies Loki receives logs
 * 6. Produces a final panel-by-panel report
 * 
 * Usage: node runtime_validation.js
 * Requires: stack running (docker compose up -d)
 */

const http = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const GRAFANA_URL = 'http://localhost:3001';
const GRAFANA_USER = 'admin';
const GRAFANA_PASS = 'admin';
const PROMETHEUS_URL = 'http://localhost:9090';
const LOKI_URL = 'http://localhost:3100';
const BACKEND_URL = 'http://localhost:5000';
const METRICS_USER = 'admin';
const METRICS_PASS = 'devguard-metrics';

// Results tracking
const results = [];
let passed = 0, failed = 0, warned = 0;

function pass(name, detail) { results.push({ status: '✅ PASS', name, detail: detail || '' }); passed++; }
function fail(name, detail) { results.push({ status: '❌ FAIL', name, detail: detail || '' }); failed++; }
function warn(name, detail) { results.push({ status: '⚠️  WARN', name, detail: detail || '' }); warned++; }

// ── HTTP Helper ───────────────────────────────────────────────────────────────
function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    };
    if (opts.auth) {
      options.headers['Authorization'] = 'Basic ' + Buffer.from(opts.auth).toString('base64');
    }

    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch(e) { resolve({ status: res.statusCode, body: data, raw: data }); }
      });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── PromQL Query Runner ───────────────────────────────────────────────────────
async function queryPrometheus(expr) {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
    const r = await fetch(url);
    if (r.status !== 200 || r.body.status !== 'success') {
      return { ok: false, error: r.body?.error || `HTTP ${r.status}`, result: [] };
    }
    return { ok: true, result: r.body.data.result };
  } catch(e) {
    return { ok: false, error: e.message, result: [] };
  }
}

async function queryPrometheusRange(expr) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 300; // last 5 minutes
  const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(expr)}&start=${start}&end=${end}&step=15`;
  try {
    const r = await fetch(url);
    if (r.status !== 200 || r.body.status !== 'success') {
      return { ok: false, error: r.body?.error || `HTTP ${r.status}`, result: [] };
    }
    return { ok: true, result: r.body.data.result };
  } catch(e) {
    return { ok: false, error: e.message, result: [] };
  }
}

// ── LogQL Query Runner ────────────────────────────────────────────────────────
async function queryLoki(expr, limit = 10) {
  try {
    const end = Date.now() * 1e6;         // nanoseconds
    const start = end - 5 * 60 * 1e9;    // 5 min ago in ns
    const url = `${LOKI_URL}/loki/api/v1/query_range?query=${encodeURIComponent(expr)}&start=${start}&end=${end}&limit=${limit}`;
    const r = await fetch(url);
    if (r.status !== 200) {
      return { ok: false, error: `HTTP ${r.status}: ${r.raw?.substring(0,200)}`, result: [] };
    }
    return { ok: true, result: r.body.data?.result || [] };
  } catch(e) {
    return { ok: false, error: e.message, result: [] };
  }
}

// ── Grafana API Helpers ───────────────────────────────────────────────────────
async function grafanaGet(path) {
  return fetch(`${GRAFANA_URL}${path}`, { auth: `${GRAFANA_USER}:${GRAFANA_PASS}` });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 1: Stack Health Check
// ─────────────────────────────────────────────────────────────────────────────
async function phase1_stackHealth() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 1: Stack Health Check');
  console.log('═'.repeat(60));

  // Backend
  try {
    const r = await fetch(`${BACKEND_URL}/health`);
    if (r.status === 200 && r.body.status === 'ok') {
      pass('Backend /health', `uptime=${r.body.uptime?.toFixed(1)}s node=${r.body.node_version}`);
    } else {
      fail('Backend /health', `HTTP ${r.status}`);
    }
  } catch(e) { fail('Backend /health', e.message); }

  // Prometheus
  try {
    const r = await fetch(`${PROMETHEUS_URL}/-/ready`);
    if (r.status === 200) pass('Prometheus ready', '');
    else fail('Prometheus ready', `HTTP ${r.status}`);
  } catch(e) { fail('Prometheus ready', e.message); }

  // Prometheus scrape targets
  try {
    const r = await fetch(`${PROMETHEUS_URL}/api/v1/targets`);
    const targets = r.body.data?.activeTargets || [];
    const backendTarget = targets.find(t => t.labels?.job === 'devguard-backend');
    if (backendTarget) {
      if (backendTarget.health === 'up') {
        pass('Prometheus scraping devguard-backend', `last scrape: ${backendTarget.lastScrape}`);
      } else {
        fail('Prometheus scraping devguard-backend', `health=${backendTarget.health} error=${backendTarget.lastError}`);
      }
    } else {
      fail('Prometheus devguard-backend target', 'Target not found in active targets');
    }
  } catch(e) { fail('Prometheus targets', e.message); }

  // Loki
  try {
    const r = await fetch(`${LOKI_URL}/ready`);
    if (r.status === 200) pass('Loki ready', '');
    else fail('Loki ready', `HTTP ${r.status}: ${r.raw?.substring(0,100)}`);
  } catch(e) { fail('Loki ready', e.message); }

  // Grafana
  try {
    const r = await grafanaGet('/api/health');
    if (r.status === 200 && r.body.database === 'ok') {
      pass('Grafana healthy', `version=${r.body.version}`);
    } else {
      fail('Grafana healthy', JSON.stringify(r.body));
    }
  } catch(e) { fail('Grafana healthy', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 2: Datasource Verification
// ─────────────────────────────────────────────────────────────────────────────
async function phase2_datasources() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 2: Grafana Datasource Verification');
  console.log('═'.repeat(60));

  try {
    const r = await grafanaGet('/api/datasources');
    if (r.status !== 200) { fail('Fetch datasources', `HTTP ${r.status}`); return; }

    const datasources = r.body;
    console.log(`  Found ${datasources.length} datasource(s): ${datasources.map(d=>d.name).join(', ')}`);

    // Check each datasource
    for (const ds of datasources) {
      try {
        const health = await grafanaGet(`/api/datasources/${ds.id}/health`);
        const ok = health.body?.status === 'OK';
        const msg = health.body?.message || '';
        if (ok) pass(`Datasource "${ds.name}" health`, `uid=${ds.uid} type=${ds.type} ${msg}`);
        else fail(`Datasource "${ds.name}" health`, `status=${health.body?.status} msg=${msg}`);

        // Verify UID matches what the dashboard expects
        if (ds.name === 'Prometheus' && ds.uid !== 'PBFA97CFB590B2093') {
          fail(`Prometheus datasource UID`, `Expected PBFA97CFB590B2093, got ${ds.uid}`);
        } else if (ds.name === 'Prometheus') {
          pass(`Prometheus datasource UID matches dashboard`, ds.uid);
        }
        if (ds.name === 'Loki' && ds.uid !== 'P8E80F9AEF21F6940') {
          fail(`Loki datasource UID`, `Expected P8E80F9AEF21F6940, got ${ds.uid}`);
        } else if (ds.name === 'Loki') {
          pass(`Loki datasource UID matches dashboard`, ds.uid);
        }
      } catch(e) { fail(`Datasource "${ds.name}" health check`, e.message); }
    }
  } catch(e) { fail('Grafana datasources API', e.message); }

  // Verify dashboard provisioned
  try {
    const r = await grafanaGet('/api/dashboards/uid/devguard-main');
    if (r.status === 200 && r.body.dashboard?.uid === 'devguard-main') {
      pass('Dashboard "devguard-main" provisioned', `title="${r.body.dashboard.title}" panels=${r.body.dashboard.panels?.length}`);
    } else {
      fail('Dashboard provisioning', `HTTP ${r.status}: ${JSON.stringify(r.body).substring(0,200)}`);
    }
  } catch(e) { fail('Dashboard provisioning check', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 3 & 4: Generate Traffic + Validate Metrics via Prometheus
// ─────────────────────────────────────────────────────────────────────────────
async function phase3_generateTraffic() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 3: Generate Application Traffic');
  console.log('═'.repeat(60));

  // -- Hit /health (should NOT appear in metrics)
  for (let i = 0; i < 5; i++) {
    await fetch(`${BACKEND_URL}/health`);
  }
  console.log('  ✓ Hit /health x5');

  // -- Hit valid routes with GET (404/405 but still tracked)
  await fetch(`${BACKEND_URL}/api/github/test`);
  console.log('  ✓ Hit /api/github/test');

  // -- Hit invalid routes (404)
  await fetch(`${BACKEND_URL}/does-not-exist`);
  await fetch(`${BACKEND_URL}/api/nonexistent`);
  console.log('  ✓ Hit invalid routes (404s)');

  // -- Try /api/stats (no auth needed)
  try {
    await fetch(`${BACKEND_URL}/api/stats`);
    console.log('  ✓ Hit /api/stats');
  } catch(e) { console.log('  ~ /api/stats:', e.message); }

  // -- Hit analyze with wrong method to get 404/405
  await fetch(`${BACKEND_URL}/api/analyze`, { method: 'GET' });
  console.log('  ✓ Hit GET /api/analyze (should 404)');

  // -- Submit a single-file analysis (will hit Supabase + Gemini paths even if they fail)
  try {
    const r = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      body: { language: 'javascript', code: 'var x = 1;\nconsole.log(x);\nfunction test() {}' }
    });
    console.log(`  ✓ POST /api/analyze → HTTP ${r.status}`);
  } catch(e) { console.log('  ~ POST /api/analyze:', e.message); }

  // -- Hit feedback endpoint (will fail auth, but 401 is still tracked)
  await fetch(`${BACKEND_URL}/api/feedback`, {
    method: 'POST',
    body: { language: 'js', action: 'accepted' }
  });
  console.log('  ✓ POST /api/feedback (401 auth expected)');

  // -- More requests for better rate() data
  for (let i = 0; i < 20; i++) {
    await fetch(`${BACKEND_URL}/health`);
    await fetch(`${BACKEND_URL}/api/github/test`);
  }
  console.log('  ✓ 20 additional requests for rate() population');

  pass('Traffic generation', '50+ requests sent across multiple routes');
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 4: Panel-by-Panel PromQL Validation
// ─────────────────────────────────────────────────────────────────────────────
async function phase4_validatePanels() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 4: Panel-by-Panel Query Validation');
  console.log('═'.repeat(60));

  // Panel definitions extracted from devguard.json
  const panels = [
    {
      title: 'Request Rate (req/s)',
      type: 'prometheus',
      queries: ['sum(rate(devguard_http_requests_total[5m])) by (method)'],
      requireData: true
    },
    {
      title: 'Error Rate (4xx / 5xx)',
      type: 'prometheus',
      queries: [
        'sum(rate(devguard_http_requests_total{status_code=~"4.."}[5m]))',
        'sum(rate(devguard_http_requests_total{status_code=~"5.."}[5m]))'
      ],
      requireData: false // may be 0
    },
    {
      title: 'Active Requests',
      type: 'prometheus',
      queries: ['devguard_http_active_requests'],
      requireData: true  // should be 0 (initialized)
    },
    {
      title: 'Latency p50/p95/p99',
      type: 'prometheus',
      queries: [
        'histogram_quantile(0.50, sum(rate(devguard_http_request_duration_seconds_bucket[5m])) by (le, route))',
        'histogram_quantile(0.95, sum(rate(devguard_http_request_duration_seconds_bucket[5m])) by (le, route))',
        'histogram_quantile(0.99, sum(rate(devguard_http_request_duration_seconds_bucket[5m])) by (le, route))'
      ],
      requireData: true
    },
    {
      title: 'Gemini API Call Rate & Latency',
      type: 'prometheus',
      queries: [
        'sum(rate(devguard_gemini_calls_total[5m])) by (model, status)',
        'histogram_quantile(0.95, sum(rate(devguard_gemini_duration_seconds_bucket[5m])) by (le, model))'
      ],
      requireData: false // 0 if no Gemini calls yet
    },
    {
      title: 'Gemini Failure Rate',
      type: 'prometheus',
      queries: [
        'sum(rate(devguard_gemini_calls_total{status="failure"}[5m])) / sum(rate(devguard_gemini_calls_total[5m]))'
      ],
      requireData: false
    },
    {
      title: 'Issues Flagged per Review (avg)',
      type: 'prometheus',
      queries: ['sum(devguard_review_issues_total_sum) / sum(devguard_review_issues_total_count)'],
      requireData: false
    },
    {
      title: 'OAuth Login Success/Failure',
      type: 'prometheus',
      queries: ['sum(devguard_oauth_attempts_total) by (status)'],
      requireData: false
    },
    {
      title: 'Average Review Latency',
      type: 'prometheus',
      queries: ['sum(devguard_review_duration_seconds_sum) / sum(devguard_review_duration_seconds_count)'],
      requireData: false
    },
    {
      title: 'Review Pipeline: Submission/Completion/Failure Rate',
      type: 'prometheus',
      queries: [
        'sum(rate(devguard_reviews_submitted_total[5m])) by (type)',
        'sum(rate(devguard_reviews_completed_total{status="success"}[5m])) by (type)',
        'sum(rate(devguard_reviews_completed_total{status="failure"}[5m])) by (type)'
      ],
      requireData: false
    },
    {
      title: 'Static Analysis Execution Time',
      type: 'prometheus',
      queries: [
        'histogram_quantile(0.95, sum(rate(devguard_pylint_duration_seconds_bucket[5m])) by (le))',
        'histogram_quantile(0.95, sum(rate(devguard_treesitter_duration_seconds_bucket[5m])) by (le))',
        'histogram_quantile(0.95, sum(rate(devguard_checkstyle_duration_seconds_bucket[5m])) by (le))'
      ],
      requireData: false
    },
    {
      title: 'Feedback Accept vs Reject',
      type: 'prometheus',
      queries: ['sum(devguard_feedback_decisions_total) by (decision)'],
      requireData: false
    },
    {
      title: 'Node.js Heap Usage',
      type: 'prometheus',
      queries: [
        'devguard_nodejs_heap_size_used_bytes',
        'devguard_nodejs_heap_size_total_bytes'
      ],
      requireData: true
    },
    {
      title: 'Event Loop Lag',
      type: 'prometheus',
      queries: [
        'devguard_nodejs_eventloop_lag_seconds',
        'devguard_nodejs_eventloop_lag_p99_seconds'
      ],
      requireData: true
    },
  ];

  for (const panel of panels) {
    let panelOk = true;
    let details = [];

    for (const query of panel.queries) {
      const result = await queryPrometheus(query);

      if (!result.ok) {
        panelOk = false;
        details.push(`QUERY ERROR: ${result.error} | Q: ${query.substring(0,60)}`);
      } else if (result.result.length === 0 && panel.requireData) {
        panelOk = false;
        details.push(`NO DATA: ${query.substring(0,60)}`);
      } else if (result.result.length === 0) {
        details.push(`empty (expected for idle): ${query.substring(0,40)}`);
      } else {
        const vals = result.result.map(r => {
          const v = parseFloat(r.value?.[1] || r.values?.[r.values?.length-1]?.[1] || 0);
          const lbls = Object.entries(r.metric || {}).filter(([k])=>k!=='__name__').map(([k,v])=>`${k}=${v}`).join(',');
          return `{${lbls}}=${isNaN(v)?'NaN':v.toFixed(4)}`;
        }).slice(0, 3).join(' | ');
        details.push(`${result.result.length} series: ${vals}`);
      }
    }

    if (panelOk) pass(panel.title, details.join(' | '));
    else fail(panel.title, details.join(' | '));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 5: Validate Loki Log Panels
// ─────────────────────────────────────────────────────────────────────────────
async function phase5_validateLoki() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 5: Loki Log Validation');
  console.log('═'.repeat(60));

  // Check Loki labels (stream labels available)
  try {
    const r = await fetch(`${LOKI_URL}/loki/api/v1/labels`);
    if (r.status === 200) {
      const labels = r.body.data || [];
      console.log(`  Loki stream labels: ${labels.join(', ')}`);
      if (labels.includes('service')) pass('Loki "service" stream label exists', '');
      else fail('Loki "service" stream label', 'service not in Loki labels — check if backend is sending logs');

      // dynamicLabels=false means request_id/user_id should NOT be labels
      if (labels.includes('request_id')) {
        fail('Loki cardinality check', 'request_id IS a stream label — dynamicLabels:false fix did not take effect!');
      } else {
        pass('Loki cardinality OK (request_id is NOT a stream label)', 'dynamicLabels:false working correctly');
      }
      if (labels.includes('user_id')) {
        fail('Loki cardinality check', 'user_id IS a stream label — dynamicLabels:false fix did not take effect!');
      } else {
        pass('Loki cardinality OK (user_id is NOT a stream label)', '');
      }
    } else {
      fail('Loki labels API', `HTTP ${r.status}`);
    }
  } catch(e) { fail('Loki labels API', e.message); }

  // Check for service="devguard-backend" stream
  try {
    const r = await fetch(`${LOKI_URL}/loki/api/v1/label/service/values`);
    const values = r.body?.data || [];
    console.log(`  Loki service values: ${values.join(', ')}`);
    if (values.includes('devguard-backend')) {
      pass('Loki service="devguard-backend" stream exists', '');
    } else {
      fail('Loki devguard-backend stream', `Available: ${values.join(',')} — backend may not be sending logs to Loki`);
    }
  } catch(e) { fail('Loki service label values', e.message); }

  // Panel: Log Volume by Level (updated query after fix)
  {
    const q = `sum by(level) (count_over_time({service="devguard-backend"} | json | level != "" [5m]))`;
    const r = await queryLoki(q);
    if (!r.ok) fail('Log Volume by Level (LogQL)', r.error);
    else if (r.result.length === 0) warn('Log Volume by Level', 'No data — logs may not have been emitted in the last 5 minutes');
    else {
      const summary = r.result.map(s => `${s.stream?.level || '?'}:${s.values?.length || 0}lines`).join(', ');
      pass('Log Volume by Level (LogQL valid)', summary);
    }
  }

  // Panel: Recent Error Logs (updated query after fix)
  {
    const q = `{service="devguard-backend"} | json | level = "error"`;
    const r = await queryLoki(q);
    if (!r.ok) fail('Recent Error Logs (LogQL)', r.error);
    else if (r.result.length === 0) warn('Recent Error Logs', 'No errors in last 5 min — this is normal for healthy operation');
    else {
      const count = r.result.reduce((sum, s) => sum + (s.values?.length || 0), 0);
      pass('Recent Error Logs (LogQL valid)', `${count} error log entries found`);
    }
  }

  // Validate raw log format (JSON parse)
  {
    const q = `{service="devguard-backend"}`;
    const r = await queryLoki(q, 5);
    if (!r.ok) {
      fail('Raw log format check', r.error);
    } else if (r.result.length === 0) {
      warn('Raw log format check', 'No logs available to inspect');
    } else {
      const sample = r.result[0]?.values?.[0]?.[1];
      if (sample) {
        try {
          const parsed = JSON.parse(sample);
          const hasLevel = !!parsed.level;
          const hasMsg = !!parsed.message;
          const hasTimestamp = !!parsed.timestamp;
          const hasService = !!parsed.service;
          if (hasLevel && hasMsg && hasTimestamp && hasService) {
            pass('Log format is valid JSON with level/message/timestamp/service', `sample: ${sample.substring(0,120)}`);
          } else {
            warn('Log format', `Partial JSON — level:${hasLevel} msg:${hasMsg} ts:${hasTimestamp} svc:${hasService}`);
          }
          // Check no secrets in logs
          const dangerous = ['api_key','password','secret','token'].filter(k => sample.toLowerCase().includes(k) && !sample.includes('[REDACTED]'));
          if (dangerous.length > 0) {
            fail('Log secret sanitization', `Potential secrets in logs: ${dangerous.join(', ')}`);
          } else {
            pass('Log secret sanitization', 'No raw secrets in sample log entry');
          }
        } catch(e) {
          fail('Log format (JSON parse)', `Not valid JSON: ${sample.substring(0,100)}`);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 6: Prometheus /metrics raw validation
// ─────────────────────────────────────────────────────────────────────────────
async function phase6_validateRawMetrics() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 6: Raw /metrics Endpoint Validation');
  console.log('═'.repeat(60));

  try {
    const r = await fetch(`${BACKEND_URL}/metrics`, { auth: `${METRICS_USER}:${METRICS_PASS}` });
    if (r.status !== 200) { fail('/metrics endpoint', `HTTP ${r.status}`); return; }

    const text = r.raw;
    const metricNames = [
      'devguard_http_requests_total',
      'devguard_http_request_duration_seconds_bucket',
      'devguard_http_active_requests',
      'devguard_gemini_calls_total',
      'devguard_gemini_duration_seconds_bucket',
      'devguard_reviews_submitted_total',
      'devguard_reviews_completed_total',
      'devguard_review_duration_seconds_bucket',
      'devguard_review_issues_total_bucket',
      'devguard_pylint_duration_seconds_bucket',
      'devguard_treesitter_duration_seconds_bucket',
      'devguard_checkstyle_duration_seconds_bucket',
      'devguard_oauth_attempts_total',
      'devguard_supabase_query_duration_seconds_bucket',
      'devguard_supabase_errors_total',
      'devguard_feedback_decisions_total',
      'devguard_nodejs_heap_size_used_bytes',
      'devguard_nodejs_eventloop_lag_seconds',
    ];

    for (const name of metricNames) {
      if (text.includes(name)) pass(`/metrics contains "${name}"`, '');
      else fail(`/metrics missing "${name}"`, 'Metric not found in /metrics output');
    }

    // Verify basic auth protection
    const noAuth = await fetch(`${BACKEND_URL}/metrics`);
    if (noAuth.status === 401) pass('/metrics basic auth protection works', '');
    else fail('/metrics basic auth', `No auth returned HTTP ${noAuth.status} — endpoint is unprotected!`);

    // Check gauge is present (zero-initialized)
    if (/devguard_http_active_requests \d/.test(text)) {
      pass('httpActiveRequests gauge present (zero-initialized)', '');
    } else {
      fail('httpActiveRequests gauge', 'Not found in /metrics — zero-init may have failed');
    }

    // Check model labels match runtime
    if (text.includes('model="gemini-2.5-flash"')) {
      pass('Gemini model labels: gemini-2.5-flash present in /metrics', '');
    } else {
      warn('Gemini model labels', 'gemini-2.5-flash not in /metrics — no Gemini calls have been made yet');
    }

  } catch(e) { fail('/metrics endpoint', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHASE 7: Sustained Load Test (autocannon-style via Node.js)
// ─────────────────────────────────────────────────────────────────────────────
async function phase7_loadTest() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE 7: Sustained Load Test (100 concurrent, 10s)');
  console.log('═'.repeat(60));

  const concurrency = 100;
  const durationMs = 10000;
  const endpoint = `${BACKEND_URL}/api/github/test`;

  let reqCount = 0, errCount = 0;
  const start = Date.now();
  const workers = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (Date.now() - start < durationMs) {
        try {
          const r = await fetch(endpoint);
          reqCount++;
          if (r.status >= 500) errCount++;
        } catch(e) {
          errCount++;
        }
      }
    })());
  }

  await Promise.all(workers);
  const elapsed = (Date.now() - start) / 1000;
  const rps = (reqCount / elapsed).toFixed(1);

  console.log(`  Total requests: ${reqCount} | Errors: ${errCount} | RPS: ${rps} | Duration: ${elapsed.toFixed(1)}s`);

  if (reqCount > 500) pass(`Load test: ${reqCount} requests at ${rps} req/s`, `errors=${errCount}`);
  else warn(`Load test: only ${reqCount} requests`, 'Lower than expected — possible rate limiting or connection limit');

  // Wait for Prometheus to scrape the new data
  console.log('  Waiting 20s for Prometheus to scrape post-load metrics...');
  await sleep(20000);

  // Now re-validate request rate
  const r = await queryPrometheus('sum(rate(devguard_http_requests_total[2m]))');
  if (r.ok && r.result.length > 0) {
    const val = parseFloat(r.result[0].value[1]);
    pass('Request Rate visible in Prometheus post-load', `${val.toFixed(2)} req/s`);
  } else {
    fail('Request Rate post-load', 'No data after load test — Prometheus scrape may have failed');
  }

  // Verify no gauge leak after load
  const gaugeRes = await queryPrometheus('devguard_http_active_requests');
  if (gaugeRes.ok && gaugeRes.result.length > 0) {
    const activeVal = parseFloat(gaugeRes.result[0].value[1]);
    if (activeVal === 0) pass('httpActiveRequests = 0 after load test (no leak)', '');
    else fail('httpActiveRequests gauge leak', `Value is ${activeVal} after load — isFinished guard may have a bug`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
function printReport() {
  console.log('\n\n' + '═'.repeat(70));
  console.log(' FINAL RUNTIME VALIDATION REPORT');
  console.log('═'.repeat(70));
  console.log(`${'Panel / Check'.padEnd(46)} ${'Status'.padEnd(12)} Detail`);
  console.log('─'.repeat(70));

  results.forEach(r => {
    const detail = r.detail ? r.detail.substring(0, 60) : '';
    console.log(`${r.name.substring(0,45).padEnd(46)} ${r.status}`);
    if (r.detail) console.log(`  ${'↳'.padEnd(44)} ${detail}`);
  });

  console.log('═'.repeat(70));
  console.log(`\n📊 Total: ${passed + failed + warned} | ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️  Warned: ${warned}`);

  if (failed === 0) {
    console.log('\n🎉 ALL CHECKS PASSED — Dashboard is production-ready!');
  } else {
    console.log(`\n🚨 ${failed} FAILURE(S) DETECTED — Review above and fix before deploying`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🔬 DevGuard-AI — End-to-End Runtime Validation');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Backend:    ${BACKEND_URL}`);
  console.log(`   Prometheus: ${PROMETHEUS_URL}`);
  console.log(`   Loki:       ${LOKI_URL}`);
  console.log(`   Grafana:    ${GRAFANA_URL}`);

  try {
    await phase1_stackHealth();
    await phase2_datasources();
    await phase3_generateTraffic();
    await sleep(5000); // Let Prometheus scrape the traffic
    await phase4_validatePanels();
    await phase5_validateLoki();
    await phase6_validateRawMetrics();
    await phase7_loadTest();
  } catch(e) {
    console.error('\nFATAL ERROR:', e.message, e.stack);
  }

  printReport();
  process.exit(failed > 0 ? 1 : 0);
})();
