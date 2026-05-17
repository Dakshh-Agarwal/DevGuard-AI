import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaEye } from "react-icons/fa";
import { FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/editor');
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Wait until session is established before navigating
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) navigate('/editor');
      else setErrorMsg('Login failed. Please try again.');

    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background" aria-hidden="true">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </div>

      <div className="auth-content">
        <div className="auth-card slide-up" role="region" aria-label="Sign in">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              
              <h1 className="logo-text">LOGIC LENS</h1>
            </div>
            <div className="auth-title">
              <h2>Welcome Back!</h2>
              <p>Sign in to continue your coding journey</p>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="error-alert fade-in" role="alert">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h4>Authentication Error</h4>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="auth-form" autoComplete="on">
            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon" aria-hidden>📧</div>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  aria-label="Email"
                />
              </div>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon" aria-hidden>🔒</div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`auth-button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <div className="loading-content">
                  <div className="auth-spinner" aria-hidden></div>
                  <span>Signing you in...</span>
                </div>
              ) : (
                <div className="button-content">
                  <span role="img" aria-hidden>🚀</span>
                  <span>Sign In</span>
                </div>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-footer">
            <div className="auth-link">
              <p>Don't have an account?</p>
              <Link to="/signup" className="link-primary">
                Create Account →
              </Link>
            </div>

            {/* Features Grid */}
            <div className="features-section">
              <h3>🌟 Platform Features</h3>
              <div className="features-grid">
                <div className="feature-item">
                  <div className="feature-icon">🤖</div>
                  <div className="feature-text">
                    <h4>AI-Powered Analysis</h4>
                    <p>Smart code review with machine learning</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🔍</div>
                  <div className="feature-text">
                    <h4>Multi-Language Support</h4>
                    <p>JavaScript, Python, Java, C++ & more</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">👥</div>
                  <div className="feature-text">
                    <h4>Team Collaboration</h4>
                    <p>Work together on code improvements</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">⚡</div>
                  <div className="feature-text">
                    <h4>Real-time Feedback</h4>
                    <p>Instant suggestions and improvements</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

  <style>{`
        /* Container + background */
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(180deg, #95b1feff 0%, #3b5ebdff 50%, #10645fff 100%);
        }

        .auth-background {
          position: fixed;
          inset: 0;
          z-index: -2;
        }

        /* Softer, modern gradient with subtle noise */
        .auth-background::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 10% 10%, rgba(120, 100, 255, 0.08), transparent 10%),
                      radial-gradient(circle at 90% 90%, rgba(255, 90, 150, 0.06), transparent 10%);
          pointer-events: none;
        }

        .floating-shapes {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: -1;
        }

        .shape {
          position: absolute;
          background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(116,75,162,0.12));
          border-radius: 24px;
          filter: blur(14px);
          transform: rotate(10deg);
          animation: float 18s infinite ease-in-out;
        }

        .shape-1 { width: 320px; height: 200px; top: 6%; left: 6%; }
        .shape-2 { width: 260px; height: 160px; bottom: 8%; right: 10%; animation-delay: 4s; }
        .shape-3 { width: 180px; height: 120px; bottom: 20%; left: 18%; animation-delay: 8s; }
        .shape-4 { width: 220px; height: 140px; top: 24%; right: 26%; animation-delay: 12s; }

        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(6deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }

        /* Card */
        .auth-content { width: 100%; max-width: 520px; }
        .auth-card {
          background: linear-gradient(135deg, #667eea 0%, #8656b6ff 80%);
          border-radius: 20px;
          padding: 2.25rem;
          box-shadow: 0 25px 60px rgba(18, 25, 40, 0.12);
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(16,24,40,0.04);
        }

        .auth-header { text-align: center; margin-bottom: 1.75rem; }

        /* Logo visibility improvements */
        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          position: relative;
          z-index: 1;
        }

        .logo-icon {
          font-size: 2.25rem;
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: linear-gradient(135deg,#6b8cff,#8b6bff);
          color: white;
          box-shadow: 0 10px 30px rgba(107,140,255,0.18);
        }

        .logo-text {
          font-size: 1.4rem;
          font-weight: 800;
          color: #111827;
          margin: 0;
          letter-spacing: -0.4px;
          text-shadow: 0 2px 8px rgba(255,255,255,0.6);
        }

        .auth-title h2 {
          font-size: 1.6rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .auth-title p {
          color: #334155;
          margin: 0.25rem 0 0;
          font-size: 0.95rem;
        }

        .error-alert {
          background: linear-gradient(90deg, rgba(254,215,215,0.9), rgba(254,202,202,0.85));
          border: 1px solid rgba(239,68,68,0.12);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.25rem;
          display: flex;
          gap: 0.75rem;
        }

        .error-icon { font-size: 1.25rem; flex-shrink: 0; }
        .error-content h4 { color: #991b1b; font-size: 0.95rem; margin: 0 0 0.25rem 0; }
        .error-content p { color: #7f1d1d; margin: 0; font-size: 0.9rem; }

        /* Form */
        .auth-form { margin-bottom: 1.25rem; }
        .input-group { margin-bottom: 1rem; }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          font-size: 1.15rem;
          color: #475569;
          z-index: 2;
        }

        .auth-input {
          width: 100%;
          padding: 0.95rem 1rem 0.95rem 3rem;
          background: white;
          border: 1px solid rgba(15,23,42,0.06);
          border-radius: 12px;
          color: #0b1220;
          font-size: 0.975rem;
          transition: all 0.18s ease;
          box-shadow: 0 8px 24px rgba(15,23,42,0.04);
        }

        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:focus {
          outline: none;
          border-color: rgba(99,102,241,0.55);
          box-shadow: 0 8px 30px rgba(99,102,241,0.12);
        }

        .password-toggle {
          position: absolute;
          right: 0.6rem;
          background: none;
          border: none;
          padding: 0.45rem;
          font-size: 1.05rem;
          cursor: pointer;
          color: #374151;
        }

        .password-toggle:hover { transform: scale(1.05); }

        .auth-button {
          width: 100%;
          padding: 0.95rem 1rem;
          background: linear-gradient(90deg, #6b8cff, #8b6bff);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(107,140,255,0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .auth-button:hover:not(:disabled) { transform: translateY(-3px); }
        .auth-button:disabled { opacity: 0.8; cursor: not-allowed; }

        .loading-content,
        .button-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .auth-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }

        .auth-footer { text-align: center; margin-top: 1.25rem; }

        .auth-link {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
        }

        .link-primary {
          color: white;
          font-weight: 700;
          text-decoration: none;
          background: linear-gradient(90deg,#6b8cff,#8b6bff);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          display: inline-block;
          transition: box-shadow 0.18s ease, transform 0.18s ease;
          box-shadow: 0 8px 22px rgba(107,140,255,0.12);
        }

        .link-primary:hover { transform: translateY(-3px); }

        .features-section h3 {
          color: #0b1220;
          font-size: 1.05rem;
          font-weight: 700;
          margin: 1rem 0 0.75rem;
          text-align: center;
        }

        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(250,250,255,0.95));
          padding: 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(15,23,42,0.04);
          box-shadow: 0 8px 26px rgba(12,18,36,0.04);
        }

        .feature-icon { font-size: 1.25rem; }
        .feature-text h4 { color: #0f172a; font-size: 0.9rem; margin: 0 0 0.25rem; }
        .feature-text p { color: #475569; font-size: 0.8rem; margin: 0; }

        @media (max-width: 640px) {
          .auth-content { max-width: 92%; }
          .features-grid { grid-template-columns: 1fr; }
          .logo-text { font-size: 1.1rem; }
          .auth-title h2 { font-size: 1.35rem; }
        }
      `}</style>
    </div>
  );
};

export default Login;