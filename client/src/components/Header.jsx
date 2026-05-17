import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsUserMenuOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const getUserInitials = (email) => {
    if (!email) return 'U';
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase();
  };

  return (
    <header className="modern-header">
      <div className="header-container">
        {/* ✅ Logo (Clickable - redirects to Home) */}
        <div 
          className="logo-section" 
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer' }}
        >
          <div className="logo-icon">
            <img src="/vite11.png" alt="Logic Lens Logo" height={35} width={35} />
          </div>
          <h1 className="logo-text">Logic Lens</h1>
        </div>

        {/* Navigation */}
        <nav className={`nav-menu ${isMenuOpen ? 'nav-open' : ''}`}>
          <a 
            href="/editor" 
            className={`nav-link ${isActive('/editor') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); navigate('/editor'); }}
          >
            <span className="nav-icon">📝</span>
            Code Editor
          </a>
          <a 
            href="/create-team" 
            className={`nav-link ${isActive('/create-team') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); navigate('/create-team'); }}
          >
            <span className="nav-icon">👥</span>
            Teams
          </a>
          <a 
            href="/admin" 
            className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
        </nav>

        {/* User Section */}
        <div className="user-section">
          {user ? (
            <div className="user-menu-container">
              <button 
                className="user-avatar-btn"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                {getUserInitials(user.email)}
              </button>
              
              {isUserMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-avatar-large">
                      {getUserInitials(user.email)}
                    </div>
                    <div className="user-details">
                      <span className="user-email">{user.email}</span>
                      <span className="user-status">Online</span>
                    </div>
                  </div>
                  <div className="user-dropdown-divider"></div>
                  <button className="logout-btn" onClick={handleSignOut}>
                    <span className="logout-icon"></span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <button 
                className="btn-secondary"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button 
                className="btn-primary"
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* ✅ Your same CSS retained */}
      <style>{`
        .modern-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .logo-section:hover {
          transform: scale(1.05);
          opacity: 0.9;
        }
        .logo-icon {
          width: 40px;
          height: 40px;
          color: white;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-text {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(45deg, #fff, #e0e7ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        /* ✅ Rest of your CSS remains the same */
        .modern-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          color: white;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-text {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(45deg, #fff, #e0e7ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .nav-menu {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-radius: 12px;
          transition: all 0.3s ease;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .nav-link.active {
          background: rgba(255, 255, 255, 0.25);
          color: white;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .nav-icon {
          font-size: 1.1rem;
        }

        .user-section {
          display: flex;
          align-items: center;
        }

        .user-menu-container {
          position: relative;
        }

        .user-avatar-btn {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b6b, #feca57);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .user-avatar-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .user-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 0;
          min-width: 280px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          animation: dropdown-appear 0.3s ease-out;
          z-index: 1001;
        }

        @keyframes dropdown-appear {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .user-dropdown-header {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-avatar-large {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-weight: 700;
          font-size: 1.3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .user-email {
          color: #1e293b;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .user-status {
          color: #10b981;
          font-size: 0.8rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .user-status::before {
          content: '';
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          display: inline-block;
        }

        .user-dropdown-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
          margin: 0 1rem;
        }

        .logout-btn {
          width: 100%;
          background: none;
          border: none;
          color: #ef4444;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          padding: 1rem 1.5rem;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-radius: 0 0 16px 16px;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .logout-icon {
          font-size: 1.1rem;
        }

        .auth-buttons {
          display: flex;
          gap: 1rem;
        }

        .btn-secondary, .btn-primary {
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.875rem;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          backdrop-filter: blur(10px);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(45deg, #ff6b6b, #feca57);
          color: white;
          box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 107, 107, 0.4);
        }

        .mobile-menu-toggle {
          display: none;
          flex-direction: column;
          gap: 3px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
        }

        .mobile-menu-toggle span {
          width: 25px;
          height: 3px;
          background: white;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        @media (max-width: 768px) {
          .header-container {
            padding: 0 1rem;
          }

          .nav-menu {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            backdrop-filter: blur(20px);
            flex-direction: column;
            gap: 0;
            padding: 1rem;
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
          }

          .nav-menu.nav-open {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
          }

          .mobile-menu-toggle {
            display: flex;
          }

          .user-dropdown {
            min-width: 250px;
            right: -20px;
          }

          .user-dropdown-header {
            padding: 1rem;
          }

          .user-avatar-large {
            width: 45px;
            height: 45px;
            font-size: 1.1rem;
          }
        }

        @media (max-width: 480px) {
          .user-dropdown {
            position: fixed;
            top: 80px;
            left: 1rem;
            right: 1rem;
            min-width: auto;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;
