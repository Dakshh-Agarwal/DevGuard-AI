import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserTeams();
  }, []);

  const fetchUserTeams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Get teams where user is a member
      const { data: teamMemberships, error: memberError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          joined_at,
          teams (
            team_id,
            team_name,
            description,
            is_private,
            created_at,
            owner_id,
            team_lead_id
          )
        `)
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error fetching team memberships:', memberError);
        throw memberError;
      }

      if (!teamMemberships || teamMemberships.length === 0) {
        console.log('No team memberships found for user');
        setTeams([]);
        return;
      }

      console.log('Team memberships found:', teamMemberships);

      // Get member counts for each team
      const teamsWithCounts = await Promise.all(
        teamMemberships.map(async (membership) => {
          if (!membership.teams) {
            console.warn('Team data missing for membership:', membership);
            return null;
          }

          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', membership.teams.team_id);

          // Determine actual role - check if user is the team owner
          const isActualOwner = membership.teams.owner_id === user.id || 
                               membership.teams.team_lead_id === user.id;
          
          const actualRole = isActualOwner ? 'owner' : 'member';

          // If there's a mismatch, log it for debugging
          if (membership.role !== actualRole) {
            console.warn(`Role mismatch for user ${user.id} in team ${membership.teams.team_id}: 
              DB role: ${membership.role}, Calculated role: ${actualRole}`);
          }

          return {
            ...membership.teams,
            role: actualRole, // Use calculated role instead of DB role
            joined_at: membership.joined_at,
            member_count: count || 0
          };
        })
      );

      // Filter out any null results
      const validTeams = teamsWithCounts.filter(team => team !== null);

      setTeams(validTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTeam = (teamId, role) => {
    // Only team owners can access the leader dashboard
    if (role === 'owner') {
      navigate(`/leader/${teamId}`);
    } else {
      alert('Access denied: Only team owners can view the leader dashboard.');
    }
  };

  if (loading) {
    return (
      <div className="container fade-in">
        <div className="loading-state">
          <div className="loading-card">
            <div className="loading-spinner"></div>
            <h3 className="loading-title">Loading Your Teams</h3>
            <p className="loading-subtitle">Please wait while we fetch your team information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      {/* Header */}
      <div className="header-gradient mb-8">
        <div className="header-content">
          <div className="header-main">
            <div className="header-icon-wrapper">
              <span className="header-icon">👥</span>
            </div>
            <div className="header-text">
              <h1 className="header-title">My Teams</h1>
              <p className="header-subtitle">
                Manage and collaborate with your development teams
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => navigate('/create-team')}
              className="action-btn primary"
            >
              ➕ Create New Team
            </button>
            <button 
              onClick={() => navigate('/join-team')}
              className="action-btn secondary"
            >
              👤➕ Join Team
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-alert scale-in">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <div className="error-text">
              <h4>Failed to Load Teams</h4>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="teams-grid">
          {teams.map((team) => (
            <div key={team.team_id} className="team-card scale-in">
              <div className="team-header">
                <div className="team-icon">
                  👥
                </div>
                <div className="team-info">
                  <h3 className="team-name">{team.team_name}</h3>
                  <p className="team-role">
                    <span className={`role-icon ${team.role === 'owner' ? 'owner' : 'member'}`}>
                      {team.role === 'owner' ? '👑' : '👤'}
                    </span>
                    {team.role === 'owner' ? 'Team Owner' : 'Member'}
                  </p>
                </div>
                <div className="team-badge">
                  {team.is_private ? (
                    <span className="badge private">🔒 Private</span>
                  ) : (
                    <span className="badge public">🌐 Public</span>
                  )}
                </div>
              </div>

              {team.description && (
                <div className="team-description">
                  <p>{team.description}</p>
                </div>
              )}

              <div className="team-stats">
                <div className="stat">
                  <span className="stat-icon">👥</span>
                  <span className="stat-text">{team.member_count} members</span>
                </div>
                <div className="stat">
                  <span className="stat-icon">📅</span>
                  <span className="stat-text">
                    Joined {new Date(team.joined_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="team-actions">
                {team.role === 'owner' ? (
                  <button
                    onClick={() => handleViewTeam(team.team_id, team.role)}
                    className="view-btn"
                  >
                    👁️ View Dashboard
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/member/${team.team_id}`)}
                    className="member-btn"
                  >
                    👤 View Team Dashboard
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-card">
            <div className="empty-icon">👥</div>
            <h3 className="empty-title">No Teams Yet</h3>
            <p className="empty-subtitle">
              You haven't joined any teams yet. Create a new team or join an existing one to start collaborating!
            </p>
            <div className="empty-actions">
              <button 
                onClick={() => navigate('/create-team')}
                className="action-btn primary"
              >
                ➕ Create Team
              </button>
              <button 
                onClick={() => navigate('/join-team')}
                className="action-btn secondary"
              >
                👤➕ Join Team
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);
          position: relative;
          overflow: hidden;
        }

        .header-gradient::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%);
          animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .header-content {
          position: relative;
          z-index: 2;
        }

        .header-main {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .header-icon-wrapper {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          padding: 1rem;
          backdrop-filter: blur(10px);
        }

        .header-icon {
          font-size: 2.5rem;
        }

        .header-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }

        .header-subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.25rem;
          margin: 0.5rem 0 0 0;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .action-btn {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          backdrop-filter: blur(10px);
          font-size: 1rem;
          text-decoration: none;
        }

        .action-btn.primary {
          background: rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.4);
        }

        .action-btn.secondary {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
          text-decoration: none;
          color: white;
        }

        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 2rem;
          margin-top: 2rem;
        }

        .team-card {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(26, 32, 44, 0.95));
          border-radius: 20px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .team-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border-color: rgba(102, 126, 234, 0.3);
        }

        .team-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .team-icon {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .team-info {
          flex: 1;
        }

        .team-name {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
        }

        .team-role {
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .role-icon {
          font-size: 0.8rem;
        }

        .role-icon.owner {
          color: #fbbf24;
        }

        .role-icon.member {
          color: #60a5fa;
        }

        .team-badge {
          flex-shrink: 0;
        }

        .badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .badge.private {
          background: rgba(239, 68, 68, 0.2);
          color: #fecaca;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .badge.public {
          background: rgba(16, 185, 129, 0.2);
          color: #a7f3d0;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .team-description {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .team-description p {
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          line-height: 1.6;
        }

        .team-stats {
          display: flex;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.9rem;
        }

        .stat-icon {
          color: #667eea;
        }

        .team-actions {
          display: flex;
          justify-content: center;
        }

        .view-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
          font-size: 1rem;
        }

        .view-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
        }

        .member-btn {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
          font-size: 1rem;
          width: 100%;
        }

        .member-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
          background: linear-gradient(135deg, #059669, #047857);
        }

        .loading-state {
          text-align: center;
          padding: 4rem 0;
        }

        .loading-card {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(26, 32, 44, 0.95));
          border-radius: 20px;
          padding: 3rem;
          display: inline-block;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(102, 126, 234, 0.2);
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        .loading-title {
          color: white;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .loading-subtitle {
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 0;
        }

        .empty-card {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(26, 32, 44, 0.95));
          border-radius: 20px;
          padding: 3rem;
          display: inline-block;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          max-width: 500px;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }

        .empty-title {
          color: white;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
        }

        .empty-subtitle {
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 2rem 0;
          line-height: 1.5;
        }

        .empty-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .error-alert {
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          border: 1px solid #f87171;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 8px 32px rgba(248, 113, 113, 0.2);
        }

        .error-content {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }

        .error-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .error-text h4 {
          color: #dc2626;
          font-size: 1.125rem;
          margin: 0 0 0.5rem 0;
          font-weight: 600;
        }

        .error-text p {
          color: #b91c1c;
          margin: 0;
          line-height: 1.5;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        .scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }

        .mb-8 {
          margin-bottom: 2rem;
        }

        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }

          .header-main {
            flex-direction: column;
            text-align: center;
          }

          .header-actions {
            flex-direction: column;
            gap: 0.75rem;
          }

          .teams-grid {
            grid-template-columns: 1fr;
          }

          .team-header {
            flex-direction: column;
            text-align: center;
          }

          .team-stats {
            justify-content: center;
            flex-wrap: wrap;
          }

          .empty-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default Teams;