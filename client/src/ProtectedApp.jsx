import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseKey } from './supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard'; // ✅ your user dashboard

const ProtectedApp = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Fetch logged-in user and profile info
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

     if (!user) {
  // Wait briefly to avoid false redirects during Supabase rehydration
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    navigate('/login');
    return;
  }
}

      setUser(user);

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (error) {
        console.error('Error fetching profile:', error);

        // Diagnostic: try direct REST fetch to see the HTTP status and response body
        try {
          const restUrl = `${window.location.protocol}//${window.location.host.replace(/:\d+$/, '')}${''}`; // placeholder (not used)
          // Construct Supabase REST URL
          const profilesUrl = `${supabaseUrl}/rest/v1/profiles?select=*&id=eq.${user.id}`;
          fetch(profilesUrl, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Accept: 'application/json'
            }
          }).then(async res => {
            const text = await res.text();
            console.warn('Supabase REST diagnostic status:', res.status, 'body:', text);
          }).catch(fetchErr => console.warn('Supabase REST diagnostic fetch failed:', fetchErr));
        } catch (diagErr) {
          console.warn('Diagnostic fetch failed:', diagErr);
        }
      } else if (profileData && profileData.length > 0) {
        // Profile exists - use the first (and should be only) profile
        setProfile(profileData[0]);
      } else {
        // No profile found - use user data as temporary profile
        console.log('No profile found for user, using user data as profile...');
        const tempProfile = {
          id: user.id,
          email: user.email || user.user_metadata?.email || 'unknown@example.com',
          // Add any other user properties you need
          ...user.user_metadata
        };
        setProfile(tempProfile);
      }

      setLoading(false);
    };

    fetchUser();
  }, [navigate]);

  // ✅ Load saved code on mount
  useEffect(() => {
    const savedCode = localStorage.getItem('editor_code');
    if (savedCode) setCode(savedCode);
  }, []);

  // ✅ Save code persistently
  useEffect(() => {
    if (code) localStorage.setItem('editor_code', code);
  }, [code]);

  // ✅ Beautiful loading screen
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              <h3>Initializing Logic Lens</h3>
              <p>Preparing your AI-powered code analysis environment...</p>
            </div>
          </div>
          <div className="loading-progress">
            <div className="progress-bar"></div>
          </div>
        </div>

        <style>{`
          .loading-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
          }
          .loading-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.9));
            border-radius: 20px;
            padding: 3rem;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
            max-width: 400px;
            width: 100%;
          }
          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
            margin-bottom: 2rem;
          }
          .loading-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(102, 126, 234, 0.2);
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-text h3 {
            color: #1e293b;
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 0.5rem 0;
          }
          .loading-text p {
            color: #64748b;
            margin: 0;
            font-size: 0.95rem;
            line-height: 1.5;
          }
          .loading-progress {
            width: 100%;
            height: 4px;
            background: rgba(102, 126, 234, 0.2);
            border-radius: 2px;
            overflow: hidden;
          }
          .progress-bar {
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
            animation: progress 2s ease-in-out infinite;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes progress { 0% { transform: translateX(-100%); } 50% { transform: translateX(0%); } 100% { transform: translateX(100%); } }
        `}</style>
      </div>
    );
  }

  // ✅ Dashboard route — automatically load correct dashboard
  if (location.pathname === '/dashboard') {
    if (profile?.is_admin) return <AdminDashboard />;
    return <UserDashboard />;
  }

  // ✅ Default protected routes (like editor)
  if (children) {
    return React.cloneElement(children, { code, setCode, user });
  }

  return <Home user={user} />;
};

export default ProtectedApp;
