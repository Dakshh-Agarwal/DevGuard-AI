const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const { supabaseQueryDuration, supabaseErrorsTotal } = require('../utils/metrics');

// 🧠 Debug endpoint to test user fetching
router.get('/debug-users', async (req, res) => {
  try {
    logger.info('Debug: testing user fetching', { context: 'stats.debug' });
    
    const { data: feedbacks, error: feedbackError } = await supabase
      .from('feedback')
      .select('user_id')
      .limit(5);

    if (feedbackError) {
      return res.status(500).json({ error: 'Failed to fetch feedbacks', details: feedbackError });
    }

    const userIds = [...new Set(feedbacks.map(f => f.user_id).filter(Boolean))];

    if (userIds.length === 0) {
      return res.json({ message: 'No user IDs found in feedback table' });
    }

    const results = {};
    for (const userId of userIds.slice(0, 3)) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        results[userId] = {
          success: !userError,
          error: userError?.message,
          user: userData?.user ? {
            email: userData.user.email,
            metadata: userData.user.user_metadata
          } : null
        };
      } catch (err) {
        results[userId] = { success: false, error: err.message };
      }
    }

    res.json({ message: 'User fetch test completed', userIds, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Main Admin Dashboard Stats API
router.get('/', async (req, res) => {
  try {
    logger.info('Starting admin stats fetch', { context: 'stats.dashboard' });

    const queryStart = process.hrtime.bigint();

    // 🚀 Fetch latest feedbacks directly from Supabase
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, querySec);

    if (error) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
      throw error;
    }

    const feedbacks = data || [];
    logger.info(`Found ${feedbacks.length} feedback entries`, {
      count: feedbacks.length,
      duration_sec: querySec.toFixed(3),
      context: 'stats.dashboard',
    });

    // Disable all caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // 🧮 Analyze user IDs
    const allUserIds = feedbacks.map(f => f.user_id);
    const nullUserIds = allUserIds.filter(id => !id);
    const validUserIds = [...new Set(allUserIds.filter(Boolean))];
    
    logger.info('User ID analysis', {
      totalEntries: feedbacks.length,
      nullUserIds: nullUserIds.length,
      uniqueValidIds: validUserIds.length,
      context: 'stats.dashboard',
    });

    // 🧠 Fetch user profiles via Supabase Admin API
    const userProfiles = {};
    
    if (validUserIds.length > 0) {
      for (const userId of validUserIds) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          
          if (!userError && userData?.user) {
            const user = userData.user;
            const displayName = user.user_metadata?.full_name || 
                                user.user_metadata?.name || 
                                user.user_metadata?.username || 
                                user.user_metadata?.user_name ||
                                user.email?.split('@')[0] ||
                                `User-${userId.substring(0, 8)}`;
                                
            userProfiles[userId] = {
              email: user.email || 'No email',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name,
              username: user.user_metadata?.username || user.user_metadata?.user_name,
              display_name: displayName
            };
          } else {
            logger.warn(`Failed to fetch user profile`, {
              user_id: userId,
              error: userError?.message,
              context: 'stats.dashboard',
            });
            userProfiles[userId] = {
              email: 'User not found',
              display_name: `User-${userId.substring(0, 8)}`,
              username: userId.substring(0, 8),
              full_name: null
            };
          }
        } catch (userErr) {
          logger.error(`Error fetching user profile`, {
            user_id: userId,
            error: userErr.message,
            context: 'stats.dashboard',
          });
          userProfiles[userId] = {
            email: 'Fetch error',
            display_name: `User-${userId.substring(0, 8)}`,
            username: userId.substring(0, 8),
            full_name: null
          };
        }
      }
    }

    // 🧩 Normalize and attach user info
    const normalized = feedbacks.map(f => {
      let userProfile;
      
      if (!f.user_id) {
        userProfile = {
          email: 'System Generated',
          display_name: 'System User',
          username: 'system'
        };
      } else if (userProfiles[f.user_id]) {
        userProfile = userProfiles[f.user_id];
      } else {
        userProfile = {
          email: 'Profile Not Found',
          display_name: `User ${f.user_id.substring(0, 8)}`,
          username: f.user_id.substring(0, 8)
        };
      }

      return {
        ...f,
        decision: (f.decision || 'pending').toLowerCase(),
        suggestion_type: (f.suggestion_type || 'general').toLowerCase(),
        user_profile: userProfile
      };
    });

    // 📊 Compute overall stats
    const stats = {
      total: normalized.length,
      accepted: normalized.filter(f => f.decision === 'accepted').length,
      rejected: normalized.filter(f => f.decision === 'rejected').length,
      errorTypes: {
        syntax: normalized.filter(f => f.suggestion_type === 'syntax').length,
        semantic: normalized.filter(f => f.suggestion_type === 'semantic').length,
        logical: normalized.filter(f => f.suggestion_type === 'logical').length,
        others: normalized.filter(f =>
          !['syntax', 'semantic', 'logical'].includes(f.suggestion_type)
        ).length
      },
      feedbacks: normalized
    };

    res.json(stats);
  } catch (err) {
    logger.error('Error in admin stats', {
      error: err.message,
      stack: err.stack,
      context: 'stats.dashboard',
    });
    res.status(500).json({ error: err.message || 'Unknown error occurred' });
  }
});

// ✅ Optional: Force refresh route for manual test
router.get('/force-refresh', async (req, res) => {
  try {
    const timestamp = Date.now();
    logger.info('Force-refreshing stats', { timestamp, context: 'stats.refresh' });
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ refreshedAt: timestamp, feedbacks: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
