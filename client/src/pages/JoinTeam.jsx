import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaUsers, FaKey, FaSearch, FaUserPlus, FaArrowRight } from 'react-icons/fa';

const JoinTeam = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [teamFound, setTeamFound] = useState(null);
  const [searchingTeam, setSearchingTeam] = useState(false);
  const navigate = useNavigate();

  // 🔍 Search Team by Invite Code
  const searchTeam = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setSearchingTeam(true);
    setError(null);
    setTeamFound(null);

    try {
      const { data, error: searchError } = await supabase
        .from('teams')
        .select(`
          *,
          team_members(count),
          profiles:owner_id(username, full_name)
        `)
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (searchError) {
        if (searchError.code === 'PGRST116') {
          setError('Team not found. Please check the invite code.');
        } else {
          throw searchError;
        }
        return;
      }

      setTeamFound(data);
    } catch (err) {
      console.error('Error searching team:', err);
      setError('Failed to search team: ' + err.message);
    } finally {
      setSearchingTeam(false);
    }
  };

  // 🤝 Handle Join Team
  const handleJoinTeam = async () => {
    if (!teamFound) return;

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to join a team');
        return;
      }

      // ✅ Check if already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamFound.team_id) // ✅ fixed (was teamFound.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        setError('You are already a member of this team');
        return;
      }

      // ✅ Add user to team
      const { error: joinError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamFound.team_id, // ✅ fixed (was undefined)
          user_id: user.id,
          role: 'member'
        });

      if (joinError) throw joinError;

      setSuccess(`Successfully joined "${teamFound.team_name}"!`);
      setInviteCode('');
      setTeamFound(null);

    } catch (err) {
      console.error('Error joining team:', err);
      setError('Failed to join team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container fade-in">
      {/* 🌈 Header */}
      <div className="header-gradient mb-8">
        <div className="header-content">
          <div className="header-main">
            <div className="header-icon-wrapper">
              <span className="header-icon">🤝</span>
            </div>
            <div className="header-text">
              <h1 className="header-title">Join Team</h1>
              <p className="header-subtitle">
                Connect with your team and start collaborating on code reviews
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Success Message */}
      {success && (
        <div className="success-panel slide-up">
          <div className="success-header">
            <span className="success-icon">🎉</span>
            <h3>Welcome to the Team!</h3>
          </div>
          <div className="success-content">
            <p>{success}</p>
            <div className="success-actions">
              <button onClick={() => navigate('/teams')} className="action-btn primary">
                <FaUsers /> View My Teams
              </button>
              <button 
                onClick={() => {
                  setSuccess(null);
                  setError(null);
                }}
                className="action-btn secondary"
              >
                Join Another Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 Main Form */}
      {!success && (
        <div className="form-container scale-in">
          <div className="form-header">
            <div className="form-title-section">
              <span className="form-icon">🔍</span>
              <h3 className="form-title">Find Your Team</h3>
            </div>
            <p className="form-subtitle">
              Enter the invite code shared by your team leader
            </p>
          </div>

          <div className="form-body">
            {/* Invite Code Input */}
            <div className="search-section">
              <div className="form-group">
                <label className="form-label">
                  <FaKey className="label-icon" /> Team Invite Code
                </label>
                <div className="search-input-group">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter 8-character invite code..."
                    className="search-input"
                    maxLength="8"
                  />
                  <button
                    onClick={searchTeam}
                    disabled={searchingTeam || !inviteCode.trim()}
                    className={`search-btn ${searchingTeam ? 'loading' : ''}`}
                  >
                    {searchingTeam ? (
                      <>
                        <span className="spinner"></span> Searching...
                      </>
                    ) : (
                      <>
                        <FaSearch /> Find Team
                      </>
                    )}
                  </button>
                </div>
                <p className="form-hint">
                  Invite codes are 8 characters long and case-insensitive
                </p>
              </div>
            </div>

            {/* 🧭 Team Found */}
            {teamFound && (
              <div className="team-found-section slide-up">
                <div className="team-card">
                  <div className="team-header">
                    <div className="team-icon">👥</div>
                    <div className="team-info">
                      <h4 className="team-name">{teamFound.team_name}</h4>
                      <p className="team-owner">
                        Created by {teamFound.profiles?.full_name || teamFound.profiles?.username || 'Unknown'}
                      </p>
                    </div>
                    <div className="team-badge">
                      {teamFound.is_private ? (
                        <span className="badge private">🔒 Private</span>
                      ) : (
                        <span className="badge public">🌐 Public</span>
                      )}
                    </div>
                  </div>
                  {teamFound.description && (
                    <div className="team-description">
                      <p>{teamFound.description}</p>
                    </div>
                  )}
                  <div className="team-stats">
                    <div className="stat">
                      <span className="stat-icon">👥</span>
                      <span className="stat-text">
                        {teamFound.team_members?.[0]?.count || 0} members
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">📅</span>
                      <span className="stat-text">
                        Created {new Date(teamFound.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="team-actions">
                    <button
                      onClick={handleJoinTeam}
                      disabled={loading}
                      className={`join-btn ${loading ? 'loading' : ''}`}
                    >
                      {loading ? (
                        <>
                          <span className="spinner"></span> Joining...
                        </>
                      ) : (
                        <>
                          <FaUserPlus /> Join Team <FaArrowRight />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚠️ Error Display */}
      {error && (
        <div className="error-alert scale-in">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <div className="error-text">
              <h4>Unable to Join</h4>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}
    

      {/* How it Works Section */}
      <div className="info-section">
        <h3 className="info-title">How to Join a Team</h3>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Get Invite Code</h4>
              <p>Ask your team leader for the 8-character invite code</p>
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Enter Code</h4>
              <p>Type or paste the invite code in the field above</p>
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Join Team</h4>
              <p>Review team details and click "Join Team" to become a member</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .container {
          max-width: 800px;
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

        .success-panel {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          border: 1px solid #10b981;
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 12px 40px rgba(16, 185, 129, 0.2);
        }

        .success-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .success-icon {
          font-size: 2rem;
        }

        .success-header h3 {
          color: #065f46;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .success-content p {
          color: #047857;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
        }

        .success-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .form-container {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(26, 32, 44, 0.95));
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          margin-bottom: 3rem;
        }

        .form-header {
          background: linear-gradient(135deg, #2d3748, #4a5568);
          padding: 2rem;
          color: white;
        }

        .form-title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .form-icon {
          font-size: 1.5rem;
        }

        .form-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .form-subtitle {
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          font-size: 1.1rem;
        }

        .form-body {
          padding: 2rem;
        }

        .search-section {
          margin-bottom: 2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .form-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .label-icon {
          color: #667eea;
        }

        .search-input-group {
          display: flex;
          gap: 1rem;
        }

        .search-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: white;
          padding: 1rem;
          font-size: 1rem;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.6);
          text-transform: none;
          letter-spacing: normal;
        }

        .search-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          white-space: nowrap;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .search-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
        }

        .search-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-hint {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.875rem;
          margin: 0;
        }

        .team-found-section {
          margin-top: 2rem;
        }

        .team-card {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.8), rgba(26, 32, 44, 0.9));
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
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
        }

        .team-info {
          flex: 1;
        }

        .team-name {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.25rem 0;
        }

        .team-owner {
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          font-size: 0.9rem;
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

        .join-btn {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        }

        .join-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
        }

        .join-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-btn {
          background: linear-gradient(135deg, var(--btn-color-start), var(--btn-color-end));
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .action-btn.primary {
          --btn-color-start: #667eea;
          --btn-color-end: #764ba2;
        }

        .action-btn.secondary {
          --btn-color-start: #64748b;
          --btn-color-end: #475569;
        }

        .action-btn:hover {
          transform: translateY(-2px);
          text-decoration: none;
          color: white;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
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

        .info-section {
          background: linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(26, 32, 44, 0.95));
          border-radius: 20px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          margin-top: 3rem;
        }

        .info-title {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin: 0 0 2rem 0;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .step-card {
          text-align: center;
          padding: 1.5rem;
        }

        .step-number {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0 auto 1rem;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .step-content h4 {
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .step-content p {
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          font-size: 0.9rem;
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

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        .scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }

        .slide-up {
          animation: slide-up 0.6s ease-out forwards;
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

          .search-input-group {
            flex-direction: column;
          }

          .team-header {
            flex-direction: column;
            text-align: center;
          }

          .team-stats {
            justify-content: center;
            flex-wrap: wrap;
          }

          .success-actions {
            flex-direction: column;
          }

          .steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default JoinTeam;