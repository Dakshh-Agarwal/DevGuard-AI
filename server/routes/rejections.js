// server/routes/rejections.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { getUserFromRequest } = require('../utils/auth');
const logger = require('../utils/logger');
const { supabaseQueryDuration, supabaseErrorsTotal } = require('../utils/metrics');

router.post('/', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { code, language } = req.body;

  const queryStart = process.hrtime.bigint();

  // Find rejected feedback by this user on same language
  const { data, error } = await supabase
    .from('feedback')
    .select('id, comment')
    .eq('language', language)
    .eq('decision', 'reject')
    .eq('source', user.id) // match user
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
  supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, querySec);

  if (error) {
    supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
    logger.error('Rejection query failed', {
      error: error.message,
      user_id: user.id,
      language,
      context: 'rejections',
    });
    return res.status(500).json({ error: error.message });
  }

  logger.info('Rejection history fetched', {
    user_id: user.id,
    language,
    count: data?.length || 0,
    duration_sec: querySec.toFixed(3),
    context: 'rejections',
  });

  return res.json(data);
});

module.exports = router;
