// server/middleware/metricsMiddleware.js
// Express middleware for automatic HTTP request instrumentation
const {
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveRequests,
} = require('../utils/metrics');

/**
 * Normalize Express route paths to prevent cardinality explosion.
 * e.g., /api/teams/abc123/members → /api/teams/:id/members
 */
function normalizeRoute(req) {
  // Use the matched Express route if available
  if (req.route && req.baseUrl !== undefined) {
    return req.baseUrl + (req.route.path === '/' ? '' : req.route.path);
  }

  // Fallback: replace UUIDs and numeric IDs in the path
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[a-f0-9]{24}(?=\/|$)/gi, ':id');
}

/**
 * Metrics middleware — auto-instruments every HTTP request.
 * Tracks: request count, latency histogram, active request gauge.
 */
function metricsMiddleware(req, res, next) {
  // Skip metrics endpoint itself to avoid recursion
  if (req.path === '/metrics') {
    return next();
  }

  const startTime = process.hrtime.bigint();
  httpActiveRequests.inc();

  // Record on response finish
  res.on('finish', () => {
    httpActiveRequests.dec();

    const route = normalizeRoute(req);
    const method = req.method;
    const statusCode = res.statusCode.toString();
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSec = durationNs / 1e9;

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route }, durationSec);
  });

  next();
}

module.exports = metricsMiddleware;
