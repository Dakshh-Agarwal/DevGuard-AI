import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedApp from './ProtectedApp';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './components/AdminDashboard';
import GithubCallback from './pages/GithubCallback';
import Editor from './pages/Editor';
import CreateTeam from './pages/CreateTeam';
import JoinTeam from './pages/JoinTeam';
import Teams from './pages/Teams';
import TeamRedirect from './components/TeamRedirect';
import LeaderDashboard from './pages/LeaderDashboard';
import MemberDashboard from './pages/MemberDashboard';

import Home from './pages/Home';
import { supabase } from './supabaseClient';

// ✅ Unified Dashboard Router — decides between Admin, Teams, or Team Creation
function DashboardRouter() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [hasTeams, setHasTeams] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        // Check if user is admin
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(profile?.is_admin || false);
        }

        // If not admin, check if user has teams
        if (!profile?.is_admin) {
          const { data: teamMemberships } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user.id)
            .limit(1);

          if (teamMemberships && teamMemberships.length > 0) {
            setHasTeams(true);
            navigate('/teams');
          } else {
            setHasTeams(false);
            navigate('/create-team');
          }
        }
      } catch (err) {
        console.error('Error checking user status:', err);
        setIsAdmin(false);
        setHasTeams(false);
        navigate('/create-team');
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [navigate]);

  if (loading)
    return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading dashboard...</div>;

  return isAdmin ? <AdminDashboard /> : null;
}

// ✅ Admin-only protection wrapper
function AdminProtectedRoute({ children }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_admin) {
        setAllowed(true);
      } else {
        navigate('/dashboard');
      }

      setLoading(false);
    };

    checkAdmin();
  }, [navigate]);

  if (loading)
    return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Checking admin access...</div>;
  return allowed ? children : null;
}

// ✅ Main App Component
const App = () => {
  return (
    <Layout>
      <Routes>
        {/* 🏠 Public Landing & Info Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />


        {/* 🛑 Admin-only access */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        {/* 🌐 Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/github-callback" element={<GithubCallback />} />

        {/* 🛡️ Protected team routes */}
        <Route
          path="/create-team"
          element={
          <TeamRedirect>
              <CreateTeam />
          </TeamRedirect>
          }
        />
        <Route
          path="/join-team"
          element={
            <TeamRedirect>
              <JoinTeam />
            </TeamRedirect>
          }
        />
        <Route path="/join/:teamId" element={<JoinTeam />} />
        <Route path="/teams" element={<ProtectedApp><Teams /></ProtectedApp>} />
        <Route path="/leader/:teamId" element={<ProtectedApp><LeaderDashboard /></ProtectedApp>} />
        <Route path="/member/:teamId" element={<ProtectedApp><MemberDashboard /></ProtectedApp>} />

        {/* 🧭 Unified Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedApp>
              <DashboardRouter />
            </ProtectedApp>
          }
        />

        {/* ✏️ Code Editor */}
        <Route
          path="/editor"
          element={
            <ProtectedApp>
              <Editor />
            </ProtectedApp>
          }
        />

        {/* 🌐 Fallback: redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
