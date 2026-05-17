import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const TeamRedirect = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [hasTeam, setHasTeam] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkTeamMembership = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }

        // Check if the user is part of any team
        const { data: memberships, error } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) throw error;

        if (memberships && memberships.length > 0) {
          setHasTeam(true);
          // If they try to go to create/join but are already in a team
          if (location.pathname.includes('create-team') || location.pathname.includes('join-team')) {
            navigate('/teams');
          }
        } else {
          setHasTeam(false);
          // If they try to go to teams but aren't part of one
          if (location.pathname.includes('teams')) {
            navigate('/create-team');
          }
        }
      } catch (err) {
        console.error('TeamRedirect error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkTeamMembership();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem', color: '#fff' }}>
        Checking team membership...
      </div>
    );
  }

  return children;
};

export default TeamRedirect;
