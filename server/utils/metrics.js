// server/utils/metrics.js
// Central Prometheus metrics registry for DevGuard-AI
const client = require('prom-client');

// Create a custom registry
const register = new client.Registry();

// Collect default Node.js metrics (event loop lag, heap, GC, CPU)
client.collectDefaultMetrics({ register, prefix: 'devguard_' });

// ============================================================
// HTTP Layer Metrics
// ============================================================

const httpRequestsTotal = new client.Counter({
  name: 'devguard_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'devguard_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

const httpActiveRequests = new client.Gauge({
  name: 'devguard_http_active_requests',
  help: 'Number of currently active HTTP requests',
  registers: [register],
});

// ============================================================
// Gemini AI Layer Metrics
// ============================================================

const geminiCallsTotal = new client.Counter({
  name: 'devguard_gemini_calls_total',
  help: 'Total Gemini API calls',
  labelNames: ['model', 'status'], // success, failure, fallback
  registers: [register],
});

const geminiDuration = new client.Histogram({
  name: 'devguard_gemini_duration_seconds',
  help: 'Gemini API response latency in seconds',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120],
  registers: [register],
});

const geminiRetriesTotal = new client.Counter({
  name: 'devguard_gemini_retries_total',
  help: 'Total Gemini API retry attempts',
  labelNames: ['model'],
  registers: [register],
});

const geminiJsonParseErrors = new client.Counter({
  name: 'devguard_gemini_json_parse_errors_total',
  help: 'Total Gemini JSON parse failures',
  registers: [register],
});

// ============================================================
// Code Review Pipeline Metrics
// ============================================================

const reviewsSubmittedTotal = new client.Counter({
  name: 'devguard_reviews_submitted_total',
  help: 'Total code reviews submitted',
  labelNames: ['type'], // single, multi
  registers: [register],
});

const reviewsCompletedTotal = new client.Counter({
  name: 'devguard_reviews_completed_total',
  help: 'Total code reviews completed',
  labelNames: ['type', 'status'], // success, failure
  registers: [register],
});

const reviewDuration = new client.Histogram({
  name: 'devguard_review_duration_seconds',
  help: 'End-to-end review latency in seconds',
  labelNames: ['type', 'language'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
  registers: [register],
});

const reviewIssuesTotal = new client.Histogram({
  name: 'devguard_review_issues_total',
  help: 'Number of issues flagged per review',
  labelNames: ['language', 'source'], // static, gemini
  buckets: [0, 1, 2, 5, 10, 20, 50],
  registers: [register],
});

const reviewQueueSize = new client.Gauge({
  name: 'devguard_review_queue_size',
  help: 'Current multi-file review queue depth',
  registers: [register],
});

// ============================================================
// Static Analysis Metrics
// ============================================================

const pylintDuration = new client.Histogram({
  name: 'devguard_pylint_duration_seconds',
  help: 'Pylint execution time in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const treesitterDuration = new client.Histogram({
  name: 'devguard_treesitter_duration_seconds',
  help: 'Tree-sitter parse time in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

const checkstyleDuration = new client.Histogram({
  name: 'devguard_checkstyle_duration_seconds',
  help: 'Checkstyle execution time in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const staticAnalysisErrors = new client.Counter({
  name: 'devguard_static_analysis_errors_total',
  help: 'Total static analysis tool errors',
  labelNames: ['tool'], // pylint, treesitter, checkstyle, eslint
  registers: [register],
});

// ============================================================
// GitHub OAuth Metrics
// ============================================================

const oauthAttemptsTotal = new client.Counter({
  name: 'devguard_oauth_attempts_total',
  help: 'Total GitHub OAuth login attempts',
  labelNames: ['status'], // success, failure, duplicate
  registers: [register],
});

// ============================================================
// Supabase / DB Metrics
// ============================================================

const supabaseQueryDuration = new client.Histogram({
  name: 'devguard_supabase_query_duration_seconds',
  help: 'Supabase query latency in seconds',
  labelNames: ['table', 'operation'], // select, insert, update, delete
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const supabaseErrorsTotal = new client.Counter({
  name: 'devguard_supabase_errors_total',
  help: 'Total Supabase query errors',
  labelNames: ['table', 'operation'],
  registers: [register],
});

// ============================================================
// Feedback Loop Metrics
// ============================================================

const feedbackDecisionsTotal = new client.Counter({
  name: 'devguard_feedback_decisions_total',
  help: 'Total feedback accept/reject decisions',
  labelNames: ['decision', 'suggestion_type'],
  registers: [register],
});

// ============================================================
// Zero-Initialization of Sparse Metrics
// ============================================================
// Zero-initialize counters to prevent Prometheus rate() from dropping single events.

// Gemini Calls — model names MUST match what geminiReview.js uses at runtime
// Runtime code uses: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash-lite
const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite'];
geminiModels.forEach(model => {
  ['success', 'failure', 'fallback'].forEach(status => {
    geminiCallsTotal.labels(model, status).inc(0);
  });
});
geminiCallsTotal.labels('all', 'fallback').inc(0);

// Reviews
['single', 'multi'].forEach(type => {
  reviewsSubmittedTotal.labels(type).inc(0);
  ['success', 'failure'].forEach(status => {
    reviewsCompletedTotal.labels(type, status).inc(0);
  });
});

// Static Analysis
['pylint', 'treesitter', 'checkstyle', 'eslint'].forEach(tool => {
  staticAnalysisErrors.labels(tool).inc(0);
});

// Gauges — initialize to 0 so they appear in /metrics from first scrape
httpActiveRequests.set(0);
reviewQueueSize.set(0);

// ============================================================
// Exports
// ============================================================

module.exports = {
  register,
  // HTTP
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveRequests,
  // Gemini
  geminiCallsTotal,
  geminiDuration,
  geminiRetriesTotal,
  geminiJsonParseErrors,
  // Review pipeline
  reviewsSubmittedTotal,
  reviewsCompletedTotal,
  reviewDuration,
  reviewIssuesTotal,
  reviewQueueSize,
  // Static analysis
  pylintDuration,
  treesitterDuration,
  checkstyleDuration,
  staticAnalysisErrors,
  // OAuth
  oauthAttemptsTotal,
  // Supabase
  supabaseQueryDuration,
  supabaseErrorsTotal,
  // Feedback
  feedbackDecisionsTotal,
};
