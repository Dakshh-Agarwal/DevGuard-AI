// server/routes/rejections.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { getUserFromRequest } = require('../utils/auth');

router.post('/', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { code, language } = req.body;

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

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

module.exports = router;
