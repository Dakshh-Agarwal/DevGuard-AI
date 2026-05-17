import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaUsers, FaCode, FaLock, FaCopy, FaCheck, FaUserPlus } from 'react-icons/fa';

const CreateTeam = () => {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const generateInviteCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to create a team');
        return;
      }

      const newInviteCode = generateInviteCode();

     const { data, error: createError } = await supabase
  .from('teams')
  .insert({
    team_name: teamName.trim(),
    description: description.trim(),
    is_private: isPrivate,
    owner_id: user.id,
    team_lead_id: user.id, // ✅ Add this line
    invite_code: newInviteCode
  })
  .select()
  .single();



      if (createError) throw createError;

      // Add creator as team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
         team_id: data.team_id,
          user_id: user.id,
          role: 'owner'
        });

      if (memberError) throw memberError;

      setInviteCode(newInviteCode);
      setSuccess('Team created successfully!');
      setTeamName('');
      setDescription('');
      setIsPrivate(false);

    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="container fade-in">
      {/* Beautiful Header */}
      <div className="header-gradient mb-8">
        <div className="header-content">
          <div className="header-main">
            <div className="header-icon-wrapper">
              <span className="header-icon">👥</span>
            </div>
            <div className="header-text">
              <h1 className="header-title">Create Team</h1>
              <p className="header-subtitle">
                Build your collaborative coding environment with AI-powered code reviews
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => navigate('/join/c80c71d8-01e1-4c03-a79e-e2925e497629')}
              className="join-team-btn"
              title="Already have an invite code? Join an existing team"
            >
              <FaUserPlus className="btn-icon" />
              Join Team Instead
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && inviteCode && (
        <div className="success-panel slide-up">
          <div className="success-header">
            <span className="success-icon">🎉</span>
            <h3>Team Created Successfully!</h3>
          </div>
          <div className="success-content">
            <p>Your team has been created. Share this invite code with your team members:</p>
            <div className="invite-code-display">
              <div className="invite-code">
                <span className="code-text">{inviteCode}</span>
                <button 
                  onClick={copyInviteCode}
                  className="copy-btn"
                  title="Copy invite code"
                >
                  {copied ? <FaCheck /> : <FaCopy />}
                </button>
              </div>
              <p className="invite-instructions">
                Team members can use this code to join your team
              </p>
            </div>
            <div className="success-actions">
              <button 
                onClick={() => navigate('/teams')}
                className="action-btn primary"
              >
                View My Teams
              </button>
              <button 
                onClick={() => {
                  setSuccess(null);
                  setInviteCode('');
                }}
                className="action-btn secondary"
              >
                Create Another Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      {!success && (
        <div className="form-container scale-in">
          <div className="form-header">
            <div className="form-title-section">
              <span className="form-icon">🚀</span>
              <h3 className="form-title">Team Configuration</h3>
            </div>
            <p className="form-subtitle">
              Set up your team's collaborative workspace
            </p>
          </div>

          <div className="form-body">
            <form onSubmit={handleCreateTeam} className="team-form">
              {/* Team Name Input */}
              <div className="form-group">
                <label className="form-label">
                  <FaUsers className="label-icon" />
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name..."
                  className="form-input"
                  required
                />
                <p className="form-hint">Choose a memorable name for your team</p>
              </div>

              {/* Description Input */}
              <div className="form-group">
                <label className="form-label">
                  <FaCode className="label-icon" />
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your team's purpose and goals..."
                  className="form-textarea"
                  rows="4"
                />
                <p className="form-hint">Optional: Describe what your team works on</p>
              </div>

              {/* Privacy Toggle */}
              <div className="form-group">
                <label className="form-label">
                  <FaLock className="label-icon" />
                  Team Privacy
                </label>
                <div className="privacy-toggle">
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="privacy-toggle"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="toggle-input"
                    />
                    <label htmlFor="privacy-toggle" className="toggle-label">
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="toggle-text">
                    <span className="toggle-title">
                      {isPrivate ? 'Private Team' : 'Public Team'}
                    </span>
                    <p className="toggle-description">
                      {isPrivate 
                        ? 'Only invited members can join this team'
                        : 'Anyone with the invite code can join'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="form-actions">
                <button
                  type="submit"
                  disabled={loading || !teamName.trim()}
                  className={`submit-btn ${loading ? 'loading' : ''}`}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Creating Team...
                    </>
                  ) : (
                    <>
                      <FaUsers />
                      Create Team
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-alert scale-in">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <div className="error-text">
              <h4>Creation Failed</h4>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Features Showcase */}
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🤖</div>
          <h4>AI Code Reviews</h4>
          <p>Get intelligent feedback on your team's code with advanced AI analysis</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h4>Team Analytics</h4>
          <p>Track your team's progress and code quality metrics</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔄</div>
          <h4>Collaboration</h4>
          <p>Work together seamlessly with shared code reviews and suggestions</p>
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

        .header-actions {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
        }

        .join-team-btn {
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
        }

        .join-team-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
        }

        .btn-icon {
          font-size: 1rem;
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

        .invite-code-display {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .invite-code {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .code-text {
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          letter-spacing: 2px;
          flex: 1;
        }

        .copy-btn {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .copy-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
        }

        .invite-instructions {
          color: #64748b;
          font-size: 0.9rem;
          margin: 0;
          text-align: center;
        }

        .success-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .form-container {
          background: linear-gradient(135deg, rgba(165, 81, 188, 0.57), rgba(91, 83, 201, 0.57));
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
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

        .team-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
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

        .form-input, .form-textarea {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: white;
          padding: 1rem;
          font-size: 1rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .form-input::placeholder, .form-textarea::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .form-textarea {
          resize: vertical;
          min-height: 120px;
        }

        .form-hint {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.875rem;
          margin: 0;
        }

        .privacy-toggle {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-wrapper {
          position: relative;
        }

        .toggle-input {
          display: none;
        }

        .toggle-label {
          display: block;
          width: 60px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .toggle-slider {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .toggle-input:checked + .toggle-label {
          background: linear-gradient(135deg, #10b981, #059669);
        }

        .toggle-input:checked + .toggle-label .toggle-slider {
          transform: translateX(28px);
        }

        .toggle-text {
          flex: 1;
        }

        .toggle-title {
          color: white;
          font-weight: 600;
          font-size: 1.1rem;
          display: block;
          margin-bottom: 0.25rem;
        }

        .toggle-description {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin: 0;
        }

        .form-actions {
          display: flex;
          justify-content: center;
          padding-top: 1rem;
        }

        .submit-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 1rem 3rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
        }

        .submit-btn:disabled {
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

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-top: 3rem;
        }

        .feature-card {
          background: linear-gradient(135deg, rgba(202, 81, 216, 0.42), rgba(90, 47, 207, 0.69));
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .feature-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .feature-card h4 {
          color: white;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
        }

        .feature-card p {
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          line-height: 1.6;
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

          .success-actions {
            flex-direction: column;
          }

          .privacy-toggle {
            flex-direction: column;
            gap: 1rem;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CreateTeam;