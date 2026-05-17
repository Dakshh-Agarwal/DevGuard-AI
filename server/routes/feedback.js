

// server/routes/feedback.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { verifyUserToken } = require('../utils/auth');

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
    const { data: teamData, error: teamError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', req.user.id)
      .single();

    if (teamError && teamError.code !== 'PGRST116') {
      console.error('Error fetching user team:', teamError.message);
      return res.status(500).json({ error: 'Failed to get user team' });
    }

    const team_id = teamData?.team_id || null;

    /* --------------------------------------------------------------
       Insert feedback record into Supabase
    -------------------------------------------------------------- */
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


    if (error) {
      console.error('Supabase insert error:', error.message);
      return res.status(500).json({ error: 'Failed to store feedback' });
    }

    res.json({ message: '✅ Feedback stored successfully', feedback: data });
  } catch (err) {
    console.error('Unexpected server error:', err);
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

    let query = supabase.from('feedback').select('*');

    if (team_id) query = query.eq('team_id', team_id);
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching feedback:', error.message);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    res.json(data);
  } catch (err) {
    console.error('Unexpected fetch error:', err);
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
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20); // Limit to recent 20 items

    if (error) {
      console.error('Error fetching user feedback:', error.message);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    res.json(feedback || []);
  } catch (err) {
    console.error('Unexpected fetch error:', err);
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

    if (error) {
      console.error('Error submitting feedback:', error.message);
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }

    res.json({ message: 'Feedback submitted successfully', feedback: data });
  } catch (err) {
    console.error('Unexpected error:', err);
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
    const { data: receivedFeedback, error } = await supabase
      .from('peer_feedback')
      .select(`
        *,
        reviewer_profiles:profiles!reviewer_id(*)
      `)
      .eq('team_id', teamId)
      .eq('reviewee_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching received feedback:', error.message);
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
    console.error('Unexpected fetch error:', err);
    res.status(500).json({ error: 'Server error while fetching received feedback' });
  }
});

module.exports = router;
