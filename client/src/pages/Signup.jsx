import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(''); 
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const handlePasswordChange = (newPassword) => {
    setPassword(newPassword);
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 3) return 'Fair';
    if (passwordStrength <= 4) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return '#ef4444';
    if (passwordStrength <= 3) return '#f59e0b';
    if (passwordStrength <= 4) return '#10b981';
    return '#059669';
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMsg(error.message);
      else {
        if (data.user && data.user.email_confirmed_at) {
          navigate('/editor');
        } else {
          setSuccessMsg('Signup successful! Please check your email to confirm, then login.');
          setTimeout(() => navigate('/login'), 3000);
        }
      }
    } catch (err) {
      console.error('Signup error:', err);
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
        <div className="auth-card slide-up">
          <div className="auth-header">
            <div className="auth-logo">
              <h1 className="logo-text">LOGIC LENS</h1>
            </div>
            <div className="auth-title">
              <h2>Create Your Account</h2>
              <p>Start your coding journey today</p>
            </div>
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="error-alert fade-in">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h4>Registration Error</h4>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}
          {successMsg && (
            <div className="success-alert fade-in">
              <div className="error-icon">🎉</div>
              <div className="error-content">
                <h4>Welcome!</h4>
                <p>{successMsg}</p>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="auth-form">
            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon">📧</div>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  aria-label="Email"
                />
              </div>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon">🔒</div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  value={password}
                  onChange={e => handlePasswordChange(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  minLength={6}
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div className="strength-fill" style={{ width: `${(passwordStrength / 6) * 100}%`, backgroundColor: getStrengthColor() }}></div>
                  </div>
                  <div className="strength-label" style={{ color: getStrengthColor() }}>{getStrengthLabel()}</div>
                </div>
              )}
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <div className="input-icon">🔐</div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  aria-label="Confirm Password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="validation-message error">Passwords don't match</div>
              )}
              {confirmPassword && password === confirmPassword && (
                <div className="validation-message success">✓ Passwords match</div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || password !== confirmPassword || password.length < 6}
              className={`auth-button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <div className="loading-content">
                  <div className="auth-spinner" aria-hidden></div>
                  <span>Creating your account...</span>
                </div>
              ) : (
                <div className="button-content">
                  <span role="img" aria-hidden>🚀</span>
                  <span>Create Account</span>
                </div>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <div className="auth-link">
              <p>Already have an account?</p>
              <Link to="/login" className="link-primary">Sign In →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Inline CSS - unified with Login page */}
  <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(180deg, #95b1feff 0%, #3b5ebdff 50%, #10645fff 100%);
        }

        .auth-background { position: fixed; inset: 0; z-index: -2; }
        .floating-shapes { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
        .shape { position: absolute; background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(116,75,162,0.12)); border-radius: 24px; filter: blur(14px); transform: rotate(10deg); animation: float 18s infinite ease-in-out; }
        .shape-1 { width: 320px; height: 200px; top: 6%; left: 6%; }
        .shape-2 { width: 260px; height: 160px; bottom: 8%; right: 10%; animation-delay: 4s; }
        .shape-3 { width: 180px; height: 120px; bottom: 20%; left: 18%; animation-delay: 8s; }
        .shape-4 { width: 220px; height: 140px; top: 24%; right: 26%; animation-delay: 12s; }
        @keyframes float { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-18px) rotate(6deg); } 100% { transform: translateY(0) rotate(0deg); } }

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
        .auth-logo { display: flex; justify-content: center; margin-bottom: 0.75rem; }
        .logo-text { font-size: 1.4rem; font-weight: 800; color: #111827; margin: 0; text-shadow: 0 2px 8px rgba(255,255,255,0.6); }
        .auth-title h2 { font-size: 1.6rem; font-weight: 700; color: #0f172a; margin: 0; }
        .auth-title p { color: #334155; margin: 0.25rem 0 0; font-size: 0.95rem; }

        .error-alert { background: linear-gradient(90deg, rgba(254,215,215,0.9), rgba(254,202,202,0.85)); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; display: flex; gap: 0.75rem; }
        .error-icon { font-size: 1.25rem; flex-shrink: 0; }
        .error-content h4 { color: #991b1b; font-size: 0.95rem; margin: 0 0 0.25rem 0; }
        .error-content p { color: #7f1d1d; margin: 0; font-size: 0.9rem; }

        .auth-form { margin-bottom: 1.25rem; }
        .input-group { margin-bottom: 1rem; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 1rem; font-size: 1.15rem; color: #475569; z-index: 2; }
        .auth-input { width: 100%; padding: 0.95rem 1rem 0.95rem 3rem; background: white; border: 1px solid rgba(15,23,42,0.06); border-radius: 12px; color: #0b1220; font-size: 0.975rem; transition: all 0.18s ease; box-shadow: 0 8px 24px rgba(15,23,42,0.04); }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-input:focus { outline: none; border-color: rgba(99,102,241,0.55); box-shadow: 0 8px 30px rgba(99,102,241,0.12); }

        .password-toggle { position: absolute; right: 0.6rem; background: none; border: none; padding: 0.45rem; font-size: 1.05rem; cursor: pointer; color: #374151; }
        .password-toggle:hover { transform: scale(1.05); }

        .auth-button { width: 100%; padding: 0.95rem 1rem; background: linear-gradient(90deg, #6b8cff, #8b6bff); border: none; border-radius: 12px; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; box-shadow: 0 12px 30px rgba(107,140,255,0.18); transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .auth-button:hover:not(:disabled) { transform: translateY(-3px); }
        .auth-button:disabled { opacity: 0.8; cursor: not-allowed; }

        .loading-content, .button-content { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .auth-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid rgba(255,255,255,0.9); border-radius: 50%; animation: spin 0.9s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .auth-footer { text-align: center; margin-top: 1.25rem; }
        .auth-link p { margin-bottom: 0.5rem; }
        .link-primary { color: white; font-weight: 700; text-decoration: none; background: linear-gradient(90deg,#6b8cff,#8b6bff); padding: 0.5rem 1rem; border-radius: 10px; display: inline-block; transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .link-primary:hover { transform: translateY(-3px); }
        
        .password-strength { margin-top: 0.5rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
        .strength-bar { flex-grow: 1; height: 6px; background: #e2e8f0; border-radius: 12px; margin-right: 0.5rem; overflow: hidden; }
        .strength-fill { height: 100%; border-radius: 12px; transition: width 0.3s ease, background-color 0.3s ease; }
        .strength-label { font-weight: 600; }

        .validation-message { font-size: 0.85rem; margin-top: 0.35rem; }
        .validation-message.error { color: #b91c1c; }
        .validation-message.success { color: #059669; }

        .fade-in { animation: fadeIn 0.45s ease forwards; opacity: 0; }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Signup;
