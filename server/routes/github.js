const express = require('express');
const axios = require('axios');
const router = express.Router();

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
  console.log('Received POST /api/github/callback');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Using GitHub CLIENT_ID:', CLIENT_ID);
  console.log('Using GitHub CLIENT_SECRET:', CLIENT_SECRET ? CLIENT_SECRET.replace(/./g, '*').slice(-4).padStart(CLIENT_SECRET.length, '*') : '<not set>');
  // Accept code from POST body or query param for robustness
  const code = req.body?.code || req.query?.code;
  if (!code) {
    console.warn('Missing OAuth code in request (body and query empty)');
    return res.status(400).json({ error: 'Missing code. Provide { code } in JSON body or ?code= in query string' });
  }

  // Server-side guard: if we already exchanged this code, return early to avoid hitting GitHub with duplicate requests
  if (exchangedCodes.has(code)) {
    console.warn('OAuth code already exchanged (server-side guard) for code:', code);
    return res.status(400).json({ error: 'This OAuth code has already been exchanged. Generate a fresh authorization.' });
  }

  // Mark code as being processed immediately to prevent race conditions
  exchangedCodes.add(code);
  console.log('Marked code as processing:', code);

  try {
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

    const { access_token, token_type, scope, error } = response.data;
    if (error || !access_token) {
      console.error('GitHub token error:', response.data);
      return res.status(400).json({ error: error || 'No access token received', details: response.data });
    }

    // Schedule cleanup after 5 minutes to avoid memory leak (code already added above)
    setTimeout(() => exchangedCodes.delete(code), 5 * 60 * 1000);

    // Optionally: fetch user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` }
    });

    res.json({ access_token, token_type, scope, github_user: userRes.data });
  } catch (err) {
    console.error('GitHub OAuth error:', err.message, err.response?.data);
    res.status(500).json({ error: 'GitHub OAuth failed', details: err.response?.data });
  }
});

module.exports = router;
