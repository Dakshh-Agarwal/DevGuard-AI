// server/routes/metricsRoute.js
// Prometheus /metrics endpoint with basic auth protection
const express = require('express');
const router = express.Router();
const { register } = require('../utils/metrics');
const logger = require('../utils/logger');

// Basic auth credentials from env vars
const METRICS_USER = process.env.METRICS_USER || 'admin';
const METRICS_PASS = process.env.METRICS_PASS || 'devguard-metrics';

/**
 * Simple basic auth middleware for /metrics endpoint.
 * Prevents public exposure of internal metrics.
 */
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
    return res.status(401).send('Authentication required');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === METRICS_USER && password === METRICS_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
  return res.status(401).send('Invalid credentials');
}

// GET /metrics — Prometheus scrape endpoint
router.get('/', basicAuth, async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    logger.error('Failed to generate metrics', { error: err.message });
    res.status(500).end('Error generating metrics');
  }
});

module.exports = router;
