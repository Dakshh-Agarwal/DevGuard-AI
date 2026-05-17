// src/pages/GithubCallback.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaGithub } from "react-icons/fa";
import fork from './fork.jpg'
const GithubCallback = () => {
  const [status, setStatus] = useState('Processing GitHub login...');
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [alreadyProcessing, setAlreadyProcessing] = useState(false);
  const hasExchanged = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Prevent double-execution from React StrictMode or re-renders
    if (alreadyProcessing || hasExchanged.current) {
      console.log('OAuth exchange already in progress or completed, skipping');
      return;
    }

    hasExchanged.current = true;

    // Extract ?code=... and ?state=... from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const storedState = sessionStorage.getItem('github_oauth_state');
    
    if (!code) {
      setStatus('No authorization code found in URL.');
      setLoading(false);
      return;
    }

    // Verify state parameter to prevent CSRF attacks
    if (state !== storedState) {
      setStatus('Invalid state parameter. Please try again.');
      setLoading(false);
      return;
    }

    // Clear the stored state
    sessionStorage.removeItem('github_oauth_state');

    // Avoid exchanging the same code twice (React StrictMode in dev may mount components twice)
    const exchangeKey = `github_oauth_exchanged_${code}`;
    if (sessionStorage.getItem(exchangeKey)) {
      console.log('OAuth code already exchanged for this session, skipping duplicate POST');
      setStatus('GitHub code already processed.');
      setLoading(false);
      return;
    }

    // Mark as processing to prevent concurrent executions
    setAlreadyProcessing(true);

    // Send code to backend to exchange for access token
    const apiUrl = import.meta.env.VITE_BACKEND_URL 
      ? `${import.meta.env.VITE_BACKEND_URL}/api/github/callback`
      : 'http://localhost:5000/api/github/callback';
      
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setStatus('GitHub login failed: ' + (data.error_description || data.error || JSON.stringify(data)));
        } else {
          // mark this code as handled for the session so repeat mounts don't re-exchange it
          sessionStorage.setItem(exchangeKey, '1');

          setStatus('GitHub login successful!');
          localStorage.setItem('github_access_token', data.access_token);
          localStorage.setItem('github_user', JSON.stringify(data.github_user));
          setUser(data.github_user);

          // Fetch user repos using the access token
          fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
            headers: { Authorization: `token ${data.access_token}` }
          })
            .then(res => res.json())
            .then(reposData => {
              setRepos(Array.isArray(reposData) ? reposData : []);
            })
            .catch(() => setRepos([]));
        }
      })
      .catch(err => {
        setStatus('GitHub login failed: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch files in selected repo or directory
  const fetchFiles = (repo, path = '') => {
    setFiles([]);
    setSelectedFile(null);
    setFileContent('');
    setCurrentPath(path);
    
    const token = localStorage.getItem('github_access_token');
    const url = path
      ? `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/${path}`
      : `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents`;
    
    fetch(url, {
      headers: { Authorization: `token ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setFiles(Array.isArray(data) ? data : []);
      })
      .catch(() => setFiles([]));
  };

  // Initial repo click
  const handleRepoClick = (repo) => {
    setSelectedRepo(repo);
    fetchFiles(repo);
  };

  // Handle file or directory click
  const handleFileClick = (file) => {
    if (file.type === 'dir') {
      // Fetch contents of directory
      fetchFiles(selectedRepo, file.path);
      return;
    }
    
    // Check if file is viewable (not binary)
    const viewableExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.json', '.md', '.txt', '.yml', '.yaml'];
    const isViewable = viewableExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isViewable) {
      alert('This file type is not supported for preview. Please select a code file.');
      return;
    }

    // Fetch file content
    setSelectedFile(file);
    setFileContent('Loading...');
    const token = localStorage.getItem('github_access_token');
    fetch(`https://api.github.com/repos/${selectedRepo.owner.login}/${selectedRepo.name}/contents/${file.path}`, {
      headers: { Authorization: `token ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.content) {
          // Decode base64 content
          const decoded = atob(data.content.replace(/\n/g, ''));
          setFileContent(decoded);
        } else {
          setFileContent('Failed to load file content.');
        }
      })
      .catch(() => setFileContent('Failed to load file content.'));
  };

  // Recursively fetch all viewable code files under a path
  const fetchAllFilesRecursive = async (repo, path = '') => {
    const token = localStorage.getItem('github_access_token');
    const url = path
      ? `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents/${path}`
      : `https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents`;

    const results = [];

    const list = await fetch(url, { headers: { Authorization: `token ${token}` } }).then(r => r.json());
    if (!Array.isArray(list)) return results;

    for (const item of list) {
      if (item.type === 'dir') {
        const nested = await fetchAllFilesRecursive(repo, item.path);
        results.push(...nested);
      } else if (item.type === 'file') {
        // only gather common code file extensions
        const viewableExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css'];
        if (!viewableExtensions.some(ext => item.name.toLowerCase().endsWith(ext))) continue;

        // fetch content
        try {
          const data = await fetch(item.url, { headers: { Authorization: `token ${token}` } }).then(r => r.json());
          if (data && data.content) {
            const decoded = atob(data.content.replace(/\n/g, ''));
            results.push({ name: item.name, path: item.path, code: decoded });
          }
        } catch (e) {
          // ignore individual file failures
          console.warn('Failed to fetch file', item.path, e);
        }
      }
    }

    return results;
  };

  const goBackDirectory = () => {
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.join('/');
    fetchFiles(selectedRepo, newPath);
  };

  if (loading) {
    return (
      <div className="container fade-in">
        <div className="text-center py-20">
          <div className="card card-glass inline-block p-8">
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-2xl font-bold text-white mb-2">Connecting to GitHub</h2>
            <p className="text-white opacity-80">Processing your authentication...</p>
            <div className="flex justify-center mt-6">
              <div className="loading-spinner"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      {/* Beautiful Header */}
      <div className="header-gradient mb-8">
        <div className="header-content">
          <div className="header-main">
            <div className="header-icon-wrapper">
              <span className="header-icon"><FaGithub /></span>
            </div>
            <div className="header-text">
              <h1 className="header-title">GitHub Integration</h1>
              <p className="header-subtitle">{status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* User Profile */}
      {user && (
        <div className="user-profile-card scale-in">
          <div className="profile-header">
            <div className="profile-avatar-section">
              <div className="avatar-wrapper">
                <img 
                  src={user.avatar_url} 
                  alt="GitHub Avatar" 
                  className="profile-avatar"
                />
                <div className="avatar-status"></div>
              </div>
              <div className="profile-info">
                <h3 className="profile-name">{user.name || user.login}</h3>
                <p className="profile-username">@{user.login}</p>
              </div>
            </div>
            <div className="profile-actions">
              <a 
                href={user.html_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="action-btn profile-btn"
              >
                🔗 View Profile
              </a>
              <div className="action-buttons-group">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('http://localhost:5000/api/teams/leave', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userId: user.id })
                      });
                      
                      if (response.ok) {
                        alert('Successfully left the team');
                      } else {
                        const error = await response.json();
                        alert(error.message || 'Failed to leave team');
                      }
                    } catch (error) {
                      console.error('Error leaving team:', error);
                      alert('Failed to leave team');
                    }
                  }}
                  className="action-btn leave-team-btn"
                >
                  👥 Leave Team
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('github_access_token');
                    localStorage.removeItem('github_user');
                    setUser(null);
                    setRepos([]);
                    setFiles([]);
                    setSelectedRepo(null);
                    setSelectedFile(null);
                    setFileContent('');
                    setStatus('Logged out from GitHub.');
                  }}
                  className="action-btn logout-btn"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository List - keeping original */}
      {repos.length > 0 && !selectedRepo && (
        <div className="card card-glass slide-up">
          <div className="card-header">
            <h3 className="text-xl font-semibold text-white">Your Repositories</h3>
            <p className="text-white opacity-80 text-sm">Click on a repository to browse files</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.slice(0, 20).map(repo => (
                <div 
                  key={repo.id} 
                  onClick={() => handleRepoClick(repo)}
                  className="repo-card"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">{repo.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${repo.private ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {repo.private ? '🔒 Private' : '🌍 Public'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{repo.description || 'No description available'}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>⭐ {repo.stargazers_count}</span>
                    <span><img src={fork} height={12} width={12}/> {repo.forks_count}</span>
                    <span>📝 {repo.language || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File Browser */}
      {selectedRepo && (
        <div className="card card-glass slide-up mb-6">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedRepo.name}</h3>
                <p className="text-white opacity-80 text-sm">
                  📁 {currentPath || 'Root directory'}
                </p>
              </div>
              <div className="flex gap-2">
                {currentPath && (
                  <button onClick={goBackDirectory} className="btn btn-ghost btn-sm">
                    ⬆️ Back
                  </button>
                )}
                {/* New: Analyze folder / repo buttons */}
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const files = await fetchAllFilesRecursive(selectedRepo, currentPath || '');
                      if (!files.length) return alert('No viewable code files found in this folder.');
                      // store files for editor to pick up
                      localStorage.setItem('github_multi_files', JSON.stringify(files));
                      navigate('/editor');
                    } catch (err) {
                      console.error(err);
                      alert('Failed to prepare folder for review');
                    } finally { setLoading(false); }
                  }}
                  className="btn btn-primary btn-sm"
                >
                  🔍 Review Folder
                </button>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const files = await fetchAllFilesRecursive(selectedRepo, '');
                      if (!files.length) return alert('No viewable code files found in this repository.');
                      localStorage.setItem('github_multi_files', JSON.stringify(files));
                      navigate('/editor');
                    } catch (err) {
                      console.error(err);
                      alert('Failed to prepare repository for review');
                    } finally { setLoading(false); }
                  }}
                  className="btn btn-accent btn-sm"
                >
                  📦 Review Entire Repo
                </button>
                <button 
                  onClick={() => { 
                    setSelectedRepo(null); 
                    setFiles([]); 
                    setSelectedFile(null); 
                    setFileContent('');
                    setCurrentPath('');
                  }} 
                  className="btn btn-secondary btn-sm"
                >
                  📋 All Repos
                </button>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {files.map(file => (
                <div 
                  key={file.path} 
                  onClick={() => handleFileClick(file)}
                  className="file-item"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {file.type === 'dir' ? '📁' : '📄'}
                    </span>
                    <div className="flex-1">
                      <span className="font-medium text-gray-800">{file.name}</span>
                      <span className="ml-2 text-xs text-gray-500 capitalize">{file.type}</span>
                    </div>
                    {file.type === 'file' && (
                      <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File Content Viewer */}
      {selectedFile && (
        <div className="card shadow-lg scale-in">
          <div className="card-header bg-gradient-to-r from-blue-500 to-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedFile.name}</h3>
                <p className="text-white opacity-80 text-sm">{selectedFile.path}</p>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('github_selected_code', fileContent);
                  localStorage.setItem('github_selected_filename', selectedFile.name);
                  navigate('/editor');
                }}
                className="btn btn-success"
                disabled={!fileContent || fileContent === 'Loading...'}
              >
                🔍 Review Code
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <pre className="code-preview">
              {fileContent}
            </pre>
          </div>
        </div>
      )}

      {/* Enhanced No User State */}
      {!user && !loading && (
        <div className="auth-required-section">
          <div className="auth-card">
            <div className="auth-icon-wrapper">
              <span className="auth-icon">🔑</span>
            </div>
            <div className="auth-content">
              <h3 className="auth-title">GitHub Authentication Required</h3>
              <p className="auth-description">
                Connect your GitHub account to browse and review your repositories
              </p>
              <div className="auth-actions">
                <button
                  onClick={() => {
                    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID ;
                    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
                    const redirectUri = `${frontendUrl.replace(/\/$/, '')}/github-callback`;
                    const scope = 'repo user';
                    const state = Math.random().toString(36).substring(7);
                    sessionStorage.setItem('github_oauth_state', state);
                    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
                    window.location.href = githubAuthUrl;
                  }}
                  className="connect-github-btn"
                >
                  🔗 Connect GitHub
                </button>
                <Link to="/editor" className="code-editor-btn">
                  ✏️ Code Editor
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

  <style>{`
        /* VIBRANT BODY BACKGROUND */
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) !important;
          min-height: 100vh;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          min-height: 100vh;
        }

        /* BEAUTIFUL HEADER */
        .header-gradient {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 25px 50px rgba(102, 126, 234, 0.4);
          position: relative;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.3);
          margin-bottom: 3rem;
        }

        .header-gradient::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.2) 100%);
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
          gap: 2rem;
        }

        .header-icon-wrapper {
          background: rgba(255, 255, 255, 0.25);
          border-radius: 50%;
          padding: 1.5rem;
          backdrop-filter: blur(15px);
          box-shadow: 0 12px 40px rgba(255, 255, 255, 0.2);
        }

        .header-icon {
          font-size: 3.5rem;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }

        .header-title {
          font-size: 3.5rem;
          font-weight: 900;
          color: white;
          margin: 0;
          text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          background: linear-gradient(45deg, #ffffff, #f0f0f0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-subtitle {
          color: rgba(255, 255, 255, 0.95);
          font-size: 1.4rem;
          margin: 0.5rem 0 0 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          font-weight: 600;
        }

        /* ENHANCED USER PROFILE CARD */
        .user-profile-card {
          background: rgba(10, 5, 5, 0.13);
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 3rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }

        .profile-avatar-section {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .avatar-wrapper {
          position: relative;
        }

        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }

        .avatar-status {
          position: absolute;
          bottom: 5px;
          right: 5px;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .profile-info {
          color: white;
        }

        .profile-name {
          font-size: 2rem;
          font-weight: 800;
          margin: 0 0 0.5rem 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .profile-username {
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          font-weight: 500;
        }

        .profile-actions {
          display: flex;
          gap: 1rem;
        }

        .action-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1rem;
          text-decoration: none;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .profile-btn {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
        }

        .logout-btn {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
        }

        .action-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
          color: white;
          text-decoration: none;
        }

        .action-buttons-group {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .leave-team-btn {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
          transition: all 0.3s ease;
        }

        .leave-team-btn:hover {
          background: linear-gradient(135deg, #818cf8, #6366f1);
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
        }

        .leave-team-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 5px 15px rgba(99, 102, 241, 0.4);
        }

        /* ENHANCED AUTH REQUIRED SECTION */
        .auth-required-section {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
        }

        .auth-card {
          background: rgba(81, 50, 181, 0.46);
          border-radius: 25px;
          padding: 3rem;
          text-align: center;
          border: 2px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(20px);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
        }

        .auth-icon-wrapper {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          padding: 1.5rem;
          display: inline-block;
          margin-bottom: 2rem;
          box-shadow: 0 12px 40px rgba(255, 255, 255, 0.2);
        }

        .auth-icon {
          font-size: 4rem;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }

        .auth-content {
          color: white;
        }

        .auth-title {
          font-size: 2.2rem;
          font-weight: 800;
          margin: 0 0 1rem 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .auth-description {
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 2.5rem 0;
          line-height: 1.6;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .auth-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .connect-github-btn {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          border: none;
          padding: 1.2rem 2.5rem;
          border-radius: 15px;
          font-weight: 700;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 12px 30px rgba(249, 115, 22, 0.4);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .connect-github-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 40px rgba(249, 115, 22, 0.5);
          background: linear-gradient(135deg, #fb923c, #f97316);
        }

        .code-editor-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.4);
          padding: 1.2rem 2.5rem;
          border-radius: 15px;
          font-weight: 700;
          font-size: 1.2rem;
          text-decoration: none;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          backdrop-filter: blur(10px);
        }

        .code-editor-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-3px);
          text-decoration: none;
          color: white;
          box-shadow: 0 15px 35px rgba(255, 255, 255, 0.2);
        }

        /* LOADING SPINNER */
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ANIMATIONS */
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        .scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }

        .slide-up {
          animation: slide-up 0.7s ease-out forwards;
        }

        /* EXISTING STYLES FOR REPO SECTION */
        .repo-card {
          background: white;
          padding: 1rem;
          border-radius: 0.75rem;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .repo-card:hover {
          border-color: var(--primary-blue);
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .file-item {
          background: white;
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .file-item:hover {
          background: #4148a5ff;
          border-color: var(--primary-blue);
          transform: translateX(4px);
        }

        .code-preview {
          background: var(--bg-dark);
          color: #080e15ff;
          padding: 1.5rem;
          font-family: 'Fira Code', 'Monaco', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          overflow-x: auto;
          max-height: 600px;
          overflow-y: auto;
          margin: 0;
          white-space: pre-wrap;
          border-color:black;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }

          .header-main {
            flex-direction: column;
            text-align: center;
          }

          .header-title {
            font-size: 2.5rem;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
          }

          .auth-actions {
            flex-direction: column;
          }

          .auth-card {
            padding: 2rem;
          }
        }

        /* UTILITY CLASSES */
        .w-20 { width: 5rem; }
        .h-20 { height: 5rem; }
        .rounded-full { border-radius: 9999px; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .border-4 { border-width: 4px; }
        .border-white { border-color: white; }
        .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        .gap-4 { gap: 1rem; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-6 { gap: 1.5rem; }
        .flex-1 { flex: 1; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .inline-block { display: inline-block; }
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
      `}</style>
    </div>
  );
};

export default GithubCallback;