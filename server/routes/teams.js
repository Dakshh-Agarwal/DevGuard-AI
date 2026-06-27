// server/routes/teams.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseClient');
const { verifyUserToken } = require('../utils/auth');
const logger = require('../utils/logger');
const { supabaseQueryDuration, supabaseErrorsTotal } = require('../utils/metrics');

// Create a new team (Leader)
router.post('/', verifyUserToken, async (req, res) => {
  const { team_name } = req.body;
  const user_id = req.user.id;

  if (!team_name) return res.status(400).json({ error: 'Team name required' });

  try {
    // Create the team
    const insertStart = process.hrtime.bigint();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert([{ team_name, team_lead_id: user_id, owner_id: user_id }])
      .select()
      .single();

    const insertSec = Number(process.hrtime.bigint() - insertStart) / 1e9;
    supabaseQueryDuration.observe({ table: 'teams', operation: 'insert' }, insertSec);

    if (teamError) {
      supabaseErrorsTotal.inc({ table: 'teams', operation: 'insert' });
      throw teamError;
    }

    // Add the creator as the team owner in team_members
    const { error: memberError } = await supabase
      .from('team_members')
      .insert([{ 
        team_id: team.team_id, 
        user_id: user_id, 
        role: 'owner',
        joined_at: new Date().toISOString()
      }]);

    if (memberError) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'insert' });
      throw memberError;
    }

    const join_link = `${process.env.VITE_FRONTEND_URL}/join/${team.team_id}`;

    logger.info('Team created', {
      team_id: team.team_id,
      team_name,
      user_id,
      context: 'teams.create',
    });

    res.json({ team_id: team.team_id, join_link });
  } catch (error) {
    logger.error('Error creating team', {
      error: error.message,
      user_id,
      team_name,
      context: 'teams.create',
    });
    res.status(500).json({ error: error.message });
  }
});

// Join team (Member)
router.get('/:teamId/join', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this team' });
    }

    // Add as regular member (not owner)
    const { data, error } = await supabase
      .from('team_members')
      .insert([{ 
        team_id: teamId, 
        user_id: user_id, 
        role: 'member',
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'insert' });
      throw error;
    }

    logger.info('User joined team', {
      team_id: teamId,
      user_id,
      context: 'teams.join',
    });

    res.json({ message: 'Joined team successfully', team_member: data });
  } catch (error) {
    logger.error('Error joining team', {
      error: error.message,
      team_id: teamId,
      user_id,
      context: 'teams.join',
    });
    res.status(500).json({ error: error.message });
  }
});

// Leader dashboard: fetch all team feedback
router.get('/:teamId/dashboard', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('team_id', teamId)
    .single();

  if (!team || team.team_lead_id !== user_id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const queryStart = process.hrtime.bigint();
  const { data: feedback, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('team_id', teamId);

  const querySec = Number(process.hrtime.bigint() - queryStart) / 1e9;
  supabaseQueryDuration.observe({ table: 'feedback', operation: 'select' }, querySec);

  if (error) {
    supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
    return res.status(500).json({ error: error.message });
  }

  logger.info('Team dashboard fetched', {
    team_id: teamId,
    feedback_count: feedback?.length || 0,
    context: 'teams.dashboard',
  });

  res.json({ feedback });
});

// Get team members with detailed info and stats
router.get('/:teamId/members', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Verify user has access to this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get team members with their profiles
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        role,
        joined_at,
        profile:profiles!user_id(*)
      `)
      .eq('team_id', teamId);

    if (membersError) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'select' });
      throw membersError;
    }

    // Map members to include profile information
    const membersWithProfiles = members.map(member => ({
      ...member,
      user_profile: member.profile || {
        email: `user-${member.user_id.substring(0, 8)}@team.local`,
        full_name: `Member ${member.user_id.substring(0, 8).toUpperCase()}`,
        username: `member_${member.user_id.substring(0, 8)}`
      }
    }));

    // Get feedback statistics for each member
    const membersWithStats = await Promise.all(
      membersWithProfiles.map(async (member) => {
        const { data: memberFeedback } = await supabase
          .from('feedback')
          .select('decision, created_at')
          .eq('team_id', teamId)
          .eq('user_id', member.user_id);

        const totalFeedback = memberFeedback?.length || 0;
        const acceptedFeedback = memberFeedback?.filter(f => f.decision === 'accepted').length || 0;
        const acceptanceRate = totalFeedback > 0 ? Math.round((acceptedFeedback / totalFeedback) * 100) : 0;

        // Calculate recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentActivity = memberFeedback?.filter(f => 
          new Date(f.created_at) > thirtyDaysAgo
        ).length || 0;

        return {
          ...member,
          stats: {
            totalFeedback,
            acceptedFeedback,
            acceptanceRate,
            recentActivity
          }
        };
      })
    );

    logger.info('Team members fetched', {
      team_id: teamId,
      member_count: membersWithStats.length,
      context: 'teams.members',
    });

    res.json({ members: membersWithStats });
  } catch (error) {
    logger.error('Error fetching team members', {
      error: error.message,
      team_id: teamId,
      context: 'teams.members',
    });
    res.status(500).json({ error: error.message });
  }
});

// Update team member role (owner/admin only)
router.patch('/:teamId/members/:userId/role', verifyUserToken, async (req, res) => {
  const { teamId, userId } = req.params;
  const { role } = req.body;
  const requesterId = req.user.id;

  try {
    // Check if requester is team owner/admin
    const { data: requesterMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', requesterId)
      .single();

    if (!requesterMembership || requesterMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Only team owners can change member roles' });
    }

    // Validate role
    if (!['owner', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be owner or member' });
    }

    // Update member role
    const { error: updateError } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (updateError) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'update' });
      throw updateError;
    }

    logger.info('Member role updated', {
      team_id: teamId,
      target_user_id: userId,
      new_role: role,
      requester_id: requesterId,
      context: 'teams.role',
    });

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    logger.error('Error updating member role', {
      error: error.message,
      team_id: teamId,
      context: 'teams.role',
    });
    res.status(500).json({ error: error.message });
  }
});

// Remove team member (owner only)
router.delete('/:teamId/members/:userId', verifyUserToken, async (req, res) => {
  const { teamId, userId } = req.params;
  const requesterId = req.user.id;

  try {
    // Check if requester is team owner
    const { data: requesterMembership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', requesterId)
      .single();

    if (!requesterMembership || requesterMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Only team owners can remove members' });
    }

    // Prevent owner from removing themselves
    if (requesterId === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the team' });
    }

    // Remove member
    const { error: removeError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (removeError) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'delete' });
      throw removeError;
    }

    logger.info('Team member removed', {
      team_id: teamId,
      removed_user_id: userId,
      requester_id: requesterId,
      context: 'teams.remove',
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Error removing member', {
      error: error.message,
      team_id: teamId,
      context: 'teams.remove',
    });
    res.status(500).json({ error: error.message });
  }
});

// Get team analytics/statistics
router.get('/:teamId/analytics', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Verify team access
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('team_id', teamId)
      .single();

    // Get member count
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    // Get feedback statistics
    const { data: feedback } = await supabase
      .from('feedback')
      .select('decision, suggestion_type, created_at')
      .eq('team_id', teamId);

    const totalFeedback = feedback?.length || 0;
    const acceptedFeedback = feedback?.filter(f => f.decision === 'accepted').length || 0;
    const rejectedFeedback = feedback?.filter(f => f.decision === 'rejected').length || 0;

    // Feedback by type
    const feedbackByType = feedback?.reduce((acc, f) => {
      const type = f.suggestion_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}) || {};

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentFeedback = feedback?.filter(f => 
      new Date(f.created_at) > thirtyDaysAgo
    ).length || 0;

    logger.info('Team analytics fetched', {
      team_id: teamId,
      totalFeedback,
      memberCount,
      context: 'teams.analytics',
    });

    res.json({
      team,
      analytics: {
        memberCount,
        totalFeedback,
        acceptedFeedback,
        rejectedFeedback,
        feedbackByType,
        recentFeedback,
        acceptanceRate: totalFeedback > 0 ? Math.round((acceptedFeedback / totalFeedback) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching team analytics', {
      error: error.message,
      team_id: teamId,
      context: 'teams.analytics',
    });
    res.status(500).json({ error: error.message });
  }
});

// Get member's personal feedback (for member dashboard)
router.get('/:teamId/my-feedback', verifyUserToken, async (req, res) => {
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

    // Get user's feedback in this team
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      supabaseErrorsTotal.inc({ table: 'feedback', operation: 'select' });
      throw feedbackError;
    }

    // Calculate personal stats
    const totalFeedback = feedback?.length || 0;
    const acceptedFeedback = feedback?.filter(f => f.decision === 'accepted').length || 0;
    const rejectedFeedback = feedback?.filter(f => f.decision === 'rejected').length || 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivity = feedback?.filter(f => 
      new Date(f.created_at) > sevenDaysAgo
    ).length || 0;

    // Average rating (if ratings are stored)
    const ratingsData = feedback?.filter(f => f.rating && !isNaN(f.rating));
    const avgRating = ratingsData?.length > 0 
      ? ratingsData.reduce((sum, f) => sum + f.rating, 0) / ratingsData.length 
      : 0;

    res.json({
      feedback: feedback?.slice(0, 10) || [], // Return latest 10 feedback items
      stats: {
        totalFeedback,
        acceptedFeedback,
        rejectedFeedback,
        recentActivity,
        avgRating: Math.round(avgRating * 10) / 10,
        acceptanceRate: totalFeedback > 0 ? Math.round((acceptedFeedback / totalFeedback) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching member feedback', {
      error: error.message,
      team_id: teamId,
      user_id,
      context: 'teams.myFeedback',
    });
    res.status(500).json({ error: error.message });
  }
});

// Get team information for member dashboard
router.get('/:teamId/info', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const user_id = req.user.id;

  try {
    // Verify team membership and get member info
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role, joined_at')
      .eq('team_id', teamId)
      .eq('user_id', user_id)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (teamError) throw teamError;

    // Get member count
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    res.json({
      team: {
        ...team,
        memberCount
      },
      memberInfo: {
        role: membership.role,
        joined_at: membership.joined_at,
        user_id,
        email: req.user.email
      }
    });
  } catch (error) {
    logger.error('Error fetching team info', {
      error: error.message,
      team_id: teamId,
      context: 'teams.info',
    });
    res.status(500).json({ error: error.message });
  }
});

// Fix team roles - utility endpoint to correct existing data
router.post('/fix-roles', verifyUserToken, async (req, res) => {
  try {
    // Get all teams and their owners
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('team_id, team_lead_id, owner_id');

    if (teamsError) throw teamsError;

    let fixedCount = 0;

    for (const team of teams) {
      const ownerId = team.owner_id || team.team_lead_id;
      
      if (ownerId) {
        // Check if owner exists in team_members
        const { data: ownerMember } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', team.team_id)
          .eq('user_id', ownerId)
          .single();

        if (!ownerMember) {
          // Add owner to team_members
          await supabase
            .from('team_members')
            .insert([{
              team_id: team.team_id,
              user_id: ownerId,
              role: 'owner',
              joined_at: new Date().toISOString()
            }]);
          fixedCount++;
        } else if (ownerMember.role !== 'owner') {
          // Update existing member to owner role
          await supabase
            .from('team_members')
            .update({ role: 'owner' })
            .eq('team_id', team.team_id)
            .eq('user_id', ownerId);
          fixedCount++;
        }

        // Ensure all other members have 'member' role (not owner)
        await supabase
          .from('team_members')
          .update({ role: 'member' })
          .eq('team_id', team.team_id)
          .neq('user_id', ownerId)
          .or('role.is.null,role.neq.member');
      }
    }

    logger.info('Team roles fixed', {
      fixedCount,
      teamsProcessed: teams.length,
      context: 'teams.fixRoles',
    });

    res.json({ 
      message: `Fixed ${fixedCount} team role assignments`,
      teamsProcessed: teams.length 
    });
  } catch (error) {
    logger.error('Error fixing team roles', {
      error: error.message,
      context: 'teams.fixRoles',
    });
    res.status(500).json({ error: error.message });
  }
});

// Leave team (Self-removal for members)
router.post('/:teamId/leave', verifyUserToken, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is a member of this team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ error: 'You are not a member of this team' });
    }

    // Prevent team owner from leaving (they must transfer ownership first)
    if (membership.role === 'owner') {
      return res.status(400).json({ 
        error: 'Team owners cannot leave the team. Please transfer ownership first or contact support.' 
      });
    }

    // Remove user from team
    const { error: removeError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (removeError) {
      supabaseErrorsTotal.inc({ table: 'team_members', operation: 'delete' });
      logger.error('Error removing user from team', {
        error: removeError.message,
        team_id: teamId,
        user_id: userId,
        context: 'teams.leave',
      });
      return res.status(500).json({ error: 'Failed to leave team' });
    }

    logger.info('User left team', {
      team_id: teamId,
      user_id: userId,
      context: 'teams.leave',
    });
    
    res.json({ 
      message: 'Successfully left the team',
      redirect: '/teams' // Suggest redirect to teams page
    });

  } catch (error) {
    logger.error('Error leaving team', {
      error: error.message,
      team_id: teamId,
      user_id: userId,
      context: 'teams.leave',
    });
    res.status(500).json({ error: error.message || 'Failed to leave team' });
  }
});

module.exports = router;
