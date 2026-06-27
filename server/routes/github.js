// server/routes/github.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const logger = require('../utils/logger');
const { oauthAttemptsTotal } = require('../utils/metrics');

// In-memory cache to avoid re-exchanging the same one-time OAuth code.
// Codes are single-use; duplicate POSTs (from double-mounts or retries) cause GitHub to reply with bad_verification_code.
const exchangedCodes = new Set();

// Test route to verify backend registration
router.get('/test', (req, res) => {
  res.json({ message: 'GitHub route is working!' });
});

// Load secrets from environment
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
;

// POST /api/github/callback
// Expects { code } in bod
router.post('/callback', async (req, res) => {
  logger.info('GitHub OAuth callback received', {
    context: 'github.oauth',
  });

  // Accept code from POST body or query param for robustness
  const code = req.body?.code || req.query?.code;
  if (!code) {
    logger.warn('Missing OAuth code in request', {
      context: 'github.oauth',
    });
    oauthAttemptsTotal.inc({ status: 'failure' });
    return res.status(400).json({ error: 'Missing code. Provide { code } in JSON body or ?code= in query string' });
  }

  // Server-side guard: if we already exchanged this code, return early to avoid hitting GitHub with duplicate requests
  if (exchangedCodes.has(code)) {
    logger.warn('OAuth code already exchanged (duplicate request)', {
      context: 'github.oauth',
    });
    oauthAttemptsTotal.inc({ status: 'duplicate' });
    return res.status(400).json({ error: 'This OAuth code has already been exchanged. Generate a fresh authorization.' });
  }

  // Mark code as being processed immediately to prevent race conditions
  exchangedCodes.add(code);

  try {
    const exchangeStart = process.hrtime.bigint();

    // Exchange code for access token
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const exchangeSec = Number(process.hrtime.bigint() - exchangeStart) / 1e9;

    const { access_token, token_type, scope, error } = response.data;
    if (error || !access_token) {
      logger.error('GitHub token exchange failed', {
        error: error || 'No access token received',
        duration_sec: exchangeSec.toFixed(3),
        context: 'github.oauth',
      });
      oauthAttemptsTotal.inc({ status: 'failure' });
      return res.status(400).json({ error: error || 'No access token received', details: response.data });
    }

    // Schedule cleanup after 5 minutes to avoid memory leak (code already added above)
    setTimeout(() => exchangedCodes.delete(code), 5 * 60 * 1000);

    // Optionally: fetch user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` }
    });

    oauthAttemptsTotal.inc({ status: 'success' });
    logger.info('GitHub OAuth login successful', {
      github_user: userRes.data?.login,
      duration_sec: exchangeSec.toFixed(3),
      context: 'github.oauth',
    });

    res.json({ access_token, token_type, scope, github_user: userRes.data });
  } catch (err) {
    oauthAttemptsTotal.inc({ status: 'failure' });
    logger.error('GitHub OAuth error', {
      error: err.message,
      response_data: err.response?.data,
      context: 'github.oauth',
    });
    res.status(500).json({ error: 'GitHub OAuth failed', details: err.response?.data });
  }
});

module.exports = router;
