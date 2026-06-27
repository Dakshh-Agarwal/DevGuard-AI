


// server/routes/feedback.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { verifyUserToken } = require('../utils/auth');
const logger = require('../utils/logger');
const {
  feedbackDecisionsTotal,
  supabaseQueryDuration,
  supabaseErrorsTotal,
} = require('../utils/metrics');

/* ------------------------------------------------------------------
   POST /api/feedback  → Store user accept/reject feedback
------------------------------------------------------------------ */
router.post('/', verifyUserToken, async (req, res) => {
  const {
    language,
    originalCode,
    suggestionText,
    action,
    optionalReason,
    autoFixApplied,
    source,
    suggestion_type,
  } = req.body;

  // ✅ Validate payload
  if (!language || !originalCode || !suggestionText || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['accepted', 'rejected'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action value' });
  }

  // ✅ Determine suggestion type — prefer frontend value
  const suggestionType = suggestion_type || getSuggestionType(suggestionText);

  try {
    /* --------------------------------------------------------------
       Get user's team_id 
    -------------------------------------------------------------- */
    const teamQueryStart = process.hrtime.bigint();
    const { data: teamData, error: teamError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', req.user.id)
      .single();

    const teamQuerySec = Number(process.hrtime.bigint() - teamQueryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'team_members', operation: 'select' }, teamQuerySec);

    if (teamError && teamError.code !== 'PGRST116') {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'select' });
      logger.error('Error fetching user team', {
        error: teamError.message,
        user_id: req.user.id,
        context: 'feedback.post',
      });
      return res.status(500).json({ error: 'Failed to get user team' });
    }

    const team_id = teamData?.team_id || null;

    /* --------------------------------------------------------------
       Insert feedback record into Supabase
    -------------------------------------------------------------- */
    const insertStart = process.hrtime.bigint();
    const { data, error } = await supabase
  .from('feedback')
  .insert([
    {
      user_id: req.user.id,        // ✅ still keep for relational joins
      email: req.user.email,       // ✅ add for human-readable identity
      team_id,
      language,
      code: originalCode,
      suggestion: suggestionText,
      decision: action,
      comment: optionalReason || '',
      suggestion_type: suggestionType,
      source: source || 'static',
      auto_fix_applied: !!autoFixApplied,
      created_at: new Date().toISOString(),
    },
  ])
  .select()
  .single();

    const insertSec = Number(process.hrtime.bigint() - insertStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'insert' }, insertSec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'insert' });
      logger.error('Supabase feedback insert error', {
        error: error.message,
        user_id: req.user.id,
        language,
        action,
        context: 'feedback.post',
      });
      return res.status(500).json({ error: 'Failed to store feedback' });
    }

    // Record feedback decision metric
    feedbackDecisionsTotal.inc({ decision: action, suggestion_type: suggestionType });

    logger.info('Feedback stored successfully', {
      user_id: req.user.id,
      decision: action,
      suggestion_type: suggestionType,
      language,
      source: source || 'static',
      team_id,
      feedback_id: data?.id,
      context: 'feedback.post',
    });

    res.json({ message: '✅ Feedback stored successfully', feedback: data });
  } catch (err) {
    logger.error('Unexpected feedback error', {
      error: err.message,
      stack: err.stack,
      user_id: req.user?.id,
      context: 'feedback.post',
    });
    res.status(500).json({ error: 'Server error while storing feedback' });
  }
});

/* ------------------------------------------------------------------
   Suggestion type detector (fallback)
------------------------------------------------------------------ */
function getSuggestionType(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('syntax')) return 'Syntax Error';
  if (lower.includes('logic')) return 'Logic Error';
  if (lower.includes('semantic')) return 'Semantic Issue';
  if (lower.includes('performance')) return 'Performance Issue';
  if (lower.includes('security')) return 'Security Risk';
  if (lower.includes('style')) return 'Code Style';
  if (lower.includes('maintain')) return 'Maintainability';
  return 'Other';
}

/* ------------------------------------------------------------------
   GET /api/feedback/all  → Optional admin route to view all feedback
------------------------------------------------------------------ */
router.get('/all', async (req, res) => {
  try {
    const { team_id, user_id } = req.query;

    const queryStart = process.hrtime.bigint();
    let query = supabase.from('feedback').select('*');

    if (team_id) query = query.eq('team_id', team_id);
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query;

    const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, querySec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
      logger.error('Error fetching feedback', {
        error: error.message,
        context: 'feedback.all',
      });
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    logger.info('Feedback fetched', {
      count: data?.length || 0,
      team_id: team_id || 'all',
      context: 'feedback.all',
    });

    res.json(data);
  } catch (err) {
    logger.error('Unexpected feedback fetch error', {
      error: err.message,
      stack: err.stack,
      context: 'feedback.all',
    });
    res.status(500).json({ error: 'Server error while fetching feedback' });
  }
});

/* ------------------------------------------------------------------
   GET /api/feedback/my/:teamId  → Get user's feedback for a specific team
------------------------------------------------------------------ */
router.get('/my/:teamId', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Verify team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get user's feedback for this team
    const queryStart = process.hrtime.bigint();
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20); // Limit to recent 20 items

    const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, querySec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
      logger.error('Error fetching user feedback', {
        error: error.message,
        user_id,
        team_id: teamId,
        context: 'feedback.my',
      });
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    res.json(feedback || []);
  } catch (err) {
    logger.error('Unexpected feedback fetch error', {
      error: err.message,
      stack: err.stack,
      user_id,
      context: 'feedback.my',
    });
    res.status(500).json({ error: 'Server error while fetching feedback' });
  }
});

/* ------------------------------------------------------------------
   POST /api/feedback/submit  → Submit feedback to a team member
------------------------------------------------------------------ */
router.post('/submit', verifyUserToken, async (req, res) => {
  const {
    team_id,
    reviewee_id,
    rating,
    comments,
    suggestions,
    category
  } = req.body;

  const reviewer_id = req.user.id;

  try {
    // Validate required fields
    if (!team_id || !reviewee_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields: team_id, reviewee_id, rating' });
    }

    // Verify both users are team members
    const { data: reviewerMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', reviewer_id)
      .single();

    const { data: revieweeMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', reviewee_id)
      .single();

    if (!reviewerMembership || !revieweeMembership) {
      return res.status(403).json({ error: 'Both users must be team members' });
    }

    // Prevent self-review
    if (reviewer_id === reviewee_id) {
      return res.status(400).json({ error: 'Cannot submit feedback to yourself' });
    }

    // Insert feedback
    const insertStart = process.hrtime.bigint();
    const { data, error } = await supabase
      .from('peer_feedback')
      .insert([{
        team_id,
        reviewer_id,
        reviewee_id,
        rating: parseInt(rating),
        comments: comments || '',
        suggestions: suggestions || '',
        category: category || 'general',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    const insertSec = Number(process.hrtime.bigint() - insertStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'peer_feedback', operation: 'insert' }, insertSec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'peer_feedback', operation: 'insert' });
      logger.error('Error submitting peer feedback', {
        error: error.message,
        reviewer_id,
        reviewee_id,
        team_id,
        context: 'feedback.submit',
      });
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }

    logger.info('Peer feedback submitted', {
      reviewer_id,
      reviewee_id,
      team_id,
      rating: parseInt(rating),
      category: category || 'general',
      context: 'feedback.submit',
    });

    res.json({ message: 'Feedback submitted successfully', feedback: data });
  } catch (err) {
    logger.error('Unexpected peer feedback error', {
      error: err.message,
      stack: err.stack,
      reviewer_id,
      context: 'feedback.submit',
    });
    res.status(500).json({ error: 'Server error while submitting feedback' });
  }
});

/* ------------------------------------------------------------------
   GET /api/feedback/received/:teamId  → Get feedback received by user in a team
------------------------------------------------------------------ */
router.get('/received/:teamId', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Verify team membership
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get feedback received by this user in this team with reviewer data
    const queryStart = process.hrtime.bigint();
    const { data: receivedFeedback, error } = await supabase
      .from('peer_feedback')
      .select(`
        *,
        reviewer_profiles:profiles!reviewer_id(*)
      `)
      .eq('team_id', teamId)
      .eq('reviewee_id', user_id)
      .order('created_at', { ascending: false });

    const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'peer_feedback', operation: 'select' }, querySec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'peer_feedback', operation: 'select' });
      logger.error('Error fetching received feedback', {
        error: error.message,
        user_id,
        team_id: teamId,
        context: 'feedback.received',
      });
      return res.status(500).json({ error: 'Failed to fetch received feedback' });
    }

    // Process feedback to ensure reviewer profiles are present
    const processedFeedback = (receivedFeedback || []).map(feedback => {
      const profile = feedback.reviewer_profiles || {};
      return {
        ...feedback,
        reviewer_profile: {
          email: profile.email || `user-${feedback.reviewer_id.substring(0, 8)}@team.local`,
          full_name: profile.full_name || `Member ${feedback.reviewer_id.substring(0, 8).toUpperCase()}`,
          username: profile.username || `member_${feedback.reviewer_id.substring(0, 8)}`
        }
      };
    });

    res.json(processedFeedback);
  } catch (err) {
    logger.error('Unexpected received feedback error', {
      error: err.message,
      stack: err.stack,
      user_id,
      context: 'feedback.received',
    });
    res.status(500).json({ error: 'Server error while fetching received feedback' });
  }
});

module.exports = router;
