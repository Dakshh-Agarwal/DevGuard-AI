import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { FaGithub } from "react-icons/fa";
import { Link } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import ResultPanel from '../components/ResultPanel';

const Editor = ({ code = '', setCode = () => {} }) => {
  const [filename, setFilename] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [multiResults, setMultiResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawBackendResponse, setRawBackendResponse] = useState(null);
  const [showGitHubIntegration, setShowGitHubIntegration] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0); // For multi-file tab navigation
  const [successMessage, setSuccessMessage] = useState(''); // Success notifications
  const [analysisProgress, setAnalysisProgress] = useState(''); // Progress updates

  const lastUploadPathsRef = useRef([]);

  // ✅ Load GitHub-imported code if present
  useEffect(() => {
    const githubCode = localStorage.getItem('github_selected_code');
    const githubFilename = localStorage.getItem('github_selected_filename');
    if (githubCode) {
      setCode(githubCode);
      setFilename(githubFilename || '');
    }
    // If user came from GitHub folder/repo review, preload multi files and auto-analyze
    const multiFilesRaw = localStorage.getItem('github_multi_files');
    if (multiFilesRaw) {
      try {
        const parsed = JSON.parse(multiFilesRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // normalized structure expected by UI (temporarily with empty analysis)
          const normalized = parsed.map(p => ({ file: p.path || p.name, code: p.code || '', analysis: { suggestions: [], geminiReview: { rawReview: 'Analyzing...', suggestions: [] } } }));
          setMultiResults(normalized);
          setFilename(normalized[0]?.file || '');
          // clear the stored payload so repeated navigations don't re-add it
          localStorage.removeItem('github_multi_files');
          
          // Auto-trigger enhanced multi-file analysis for GitHub imports
          console.log('🔄 Auto-starting enhanced multi-file analysis for GitHub import...');
          setTimeout(() => analyzeGithubMultiFiles(parsed), 500);
        }
      } catch (e) {
        console.warn('Failed to parse github_multi_files', e);
      }
    }
  }, [setCode]);

  // ✅ Auto-sync code in editor with multiResults when only one file
  useEffect(() => {
    if (multiResults.length === 1) {
      setMultiResults(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], code };
        return updated;
      });
    }
  }, [code]);

  // Auto-analyze GitHub multi-file imports using enhanced analysis
  const analyzeGithubMultiFiles = async (parsedFiles) => {
    console.log('🔄 Starting enhanced multi-file analysis for GitHub import...', { fileCount: parsedFiles.length });
    setLoading(true);
    setError(null);
    setAnalysisProgress(`Preparing ${parsedFiles.length} files for enhanced analysis...`);
    
    try {
      // Create FormData with GitHub files
      const formData = new FormData();
      const paths = [];
      
      for (const fileData of parsedFiles) {
        // Create a File-like object from GitHub data
        const blob = new Blob([fileData.code], { type: 'text/plain' });
        const file = new File([blob], fileData.name || fileData.path, { type: 'text/plain' });
        formData.append('files', file);
        paths.push(fileData.path || fileData.name);
      }
      
      formData.append('paths', JSON.stringify(paths));
      
      console.log('🔄 Calling enhanced multi-file analysis endpoint...', { paths });
      setAnalysisProgress(`Analyzing ${parsedFiles.length} files with AI (this may take several minutes)...`);

      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/multi`, formData, {
        timeout: 300000  // Increased to 5 minutes for large multi-file analysis
      });

      const fullResponse = res.data;
      setRawBackendResponse(fullResponse);
      console.log('✅ Enhanced multi-file analysis completed', { resultCount: fullResponse.results?.length });

      const backendResults = fullResponse.results || [];
      if (!backendResults.length) throw new Error('Enhanced analysis returned no results');

      const normalizedResults = backendResults.map((backendResult, index) => {
        const filenameFromBackend = backendResult.file && backendResult.file !== 'unknown' ? backendResult.file : null;
        const filenameResolved = filenameFromBackend || paths[index] || `file-${index}`;
        const codeFromBackend = backendResult.code || parsedFiles[index]?.code || '';
        const analysis = backendResult.analysis || { suggestions: [], geminiReview: { rawReview: 'No enhanced analysis available', suggestions: [] } };
        
        return {
          file: filenameResolved,
          code: codeFromBackend,
          analysis: analysis
        };
      });

      setMultiResults(normalizedResults);
      setAnalysisProgress('');
      console.log('✅ GitHub multi-file analysis results updated in UI');
      
    } catch (error) {
      console.error('❌ GitHub multi-file analysis failed:', error);
      setAnalysisProgress('');
      
      if (error.code === 'ECONNABORTED') {
        setError(`Analysis timed out after 5 minutes. Please try analyzing fewer files or smaller files.`);
      } else {
        setError(`Enhanced analysis failed: ${error.message}`);
      }
      
      // Keep the files loaded but with error state
      setMultiResults(prev => prev.map(item => ({
        ...item,
        analysis: { 
          suggestions: [], 
          geminiReview: { rawReview: `Analysis failed: ${error.message}`, suggestions: [] }
        }
      })));
    } finally {
      setLoading(false);
    }
  };

  // Detect language from filename
  const detectLanguage = (filename) => {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (ext === 'py') return 'python';
    if (ext === 'java') return 'java';
    if (['c', 'cpp', 'h'].includes(ext)) return ext === 'c' ? 'c' : 'cpp';
    return 'javascript';
  };

  // Multi-file editor functions
  const updateActiveFileCode = (newCode) => {
    console.log('📝 Editor updateActiveFileCode called with:', { 
      newCode: newCode.substring(0, 100) + '...', 
      activeFileIndex, 
      multiResultsLength: multiResults.length 
    });
    
    setMultiResults(prev => {
      const updated = [...prev];
      if (updated[activeFileIndex]) {
        updated[activeFileIndex] = { ...updated[activeFileIndex], code: newCode };
      }
      return updated;
    });
    
    // Also update the single file code if we're in single file mode
    if (multiResults.length === 1) {
      console.log('📝 Editor - Also updating single file setCode');
      setCode(newCode);
    }
  };

  const switchToFile = (index) => {
    setActiveFileIndex(index);
    if (multiResults[index]) {
      setLanguage(detectLanguage(multiResults[index].file));
      setFilename(multiResults[index].file);
    }
  };

  const getActiveFile = () => {
    return multiResults[activeFileIndex] || null;
  };

  // Re-analyze single file
  const reAnalyzeSingleFile = async (fileIndex = activeFileIndex) => {
    const fileToAnalyze = multiResults[fileIndex];
    if (!fileToAnalyze) return;

    console.log(`🔄 Re-analyzing single file: ${fileToAnalyze.file}`);
    setLoading(true);
    setError(null);
    
    try {
      // Use single-file analysis endpoint for faster response
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/analyze`, {
        code: fileToAnalyze.code,
        language: detectLanguage(fileToAnalyze.file)
      }, { timeout: 60000 });

      console.log(`✅ Single file re-analysis completed for ${fileToAnalyze.file}`);

      // Update just this file's analysis
      setMultiResults(prev => {
        const updated = [...prev];
        updated[fileIndex] = {
          ...updated[fileIndex],
          analysis: response.data
        };
        return updated;
      });

      setSuccessMessage(`✅ Successfully re-analyzed ${fileToAnalyze.file}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error(`❌ Single file re-analysis failed for ${fileToAnalyze.file}:`, error);
      setError(`Re-analysis failed for ${fileToAnalyze.file}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Re-analyze all loaded files (for Re-analyze All button)
  const reAnalyzeAllFiles = async () => {
    console.log('🔄 Re-analyzing all loaded files...', { fileCount: multiResults.length });
    setLoading(true);
    setError(null);
    
    try {
      // Create FormData with current file contents (including any edits)
      const formData = new FormData();
      const paths = [];
      
      for (const fileData of multiResults) {
        // Create a File-like object from current file data (including edits)
        const blob = new Blob([fileData.code], { type: 'text/plain' });
        const file = new File([blob], fileData.file, { type: 'text/plain' });
        formData.append('files', file);
        paths.push(fileData.file);
      }
      
      formData.append('paths', JSON.stringify(paths));
      
      console.log('🔄 Calling enhanced multi-file analysis endpoint for re-analysis...', { paths });
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/multi`, formData, {
        timeout: 300000  // Increased to 5 minutes for large multi-file analysis
      });

      const fullResponse = res.data;
      setRawBackendResponse(fullResponse);
      console.log('✅ Re-analysis completed', { resultCount: fullResponse.results?.length });

      const backendResults = fullResponse.results || [];
      if (!backendResults.length) throw new Error('Re-analysis returned no results');

      // Update the multiResults with new analysis while preserving current code
      const updatedResults = backendResults.map((backendResult, index) => {
        const currentFile = multiResults[index];
        const filenameFromBackend = backendResult.file && backendResult.file !== 'unknown' ? backendResult.file : null;
        const filenameResolved = filenameFromBackend || paths[index] || `file-${index}`;
        
        return {
          file: filenameResolved,
          code: currentFile?.code || backendResult.code || '', // Keep current edited code
          analysis: backendResult.analysis || { suggestions: [], geminiReview: { rawReview: 'No enhanced analysis available', suggestions: [] } }
        };
      });

      setMultiResults(updatedResults);
      setSuccessMessage(`✅ Successfully re-analyzed ${updatedResults.length} files`);
      setTimeout(() => setSuccessMessage(''), 3000);
      console.log('✅ Re-analysis results updated in UI');
      
    } catch (error) {
      console.error('❌ Re-analysis failed:', error);
      setError(`Re-analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // ----------------- Single File Analysis -----------------
  const handleSingleFileAnalyze = async () => {
    const codeToAnalyze = String(code || '').trim();
    if (!codeToAnalyze) {
      setError('Please paste some code in the editor before analyzing');
      return;
    }

    const analysisLanguage = language || detectLanguage(filename || 'file.js');
    setLoading(true);
    setError(null);
    setMultiResults([]);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/analyze`, {
        language: analysisLanguage,
        code: codeToAnalyze
      }, { timeout: 60000 });

      const fullResponse = res.data;
      setRawBackendResponse(fullResponse);

      const analysis = {
        geminiReview: fullResponse.geminiReview || { rawReview: '', suggestions: [] },
        suggestions: fullResponse.suggestions || []
      };

      setFilename(filename || `${analysisLanguage}-file`);
      setMultiResults([{
        file: filename || `editor-content.${analysisLanguage === 'javascript' ? 'js' : analysisLanguage}`,
        code: codeToAnalyze,
        analysis
      }]);
    } catch (err) {
      console.error('Single-file error:', err);
      setError('Single-file analysis failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ----------------- Multi File Upload -----------------
  const handleMultiFileUpload = async (e) => {
    const files = Array.from(e.target.files || []).filter(file =>
      /\.(js|jsx|ts|tsx|py|java|c|cpp|h)$/i.test(file.name)
    );

    if (!files.length) {
      setError('No code files selected. Please choose .js, .py, .java, etc.');
      return;
    }

    setLoading(true);
    setError(null);
    setMultiResults([]);
    lastUploadPathsRef.current = [];

    try {
      const fileData = await Promise.all(
        files.map(async (file) => ({
          file,
          code: await readFileContent(file)
        }))
      );

      const formData = new FormData();
      fileData.forEach(({ file }) => formData.append('files', file));
      const paths = fileData.map(fd => fd.file.webkitRelativePath || fd.file.name);
      lastUploadPathsRef.current = paths;
      formData.append('paths', JSON.stringify(paths));

      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/analyze/multi`, formData, {
        timeout: 120000
      });

      const fullResponse = res.data;
      setRawBackendResponse(fullResponse);

      const backendResults = fullResponse.results || [];
      if (!backendResults.length) throw new Error('Backend returned no results');

      const normalizedResults = backendResults.map((backendResult, index) => {
        const filenameFromBackend = backendResult.file && backendResult.file !== 'unknown' ? backendResult.file : null;
        const filenameResolved = filenameFromBackend || lastUploadPathsRef.current[index] || `file-${index}`;
        const codeFromBackend = backendResult.code || '';
        const analysis = backendResult.analysis || {};

        return {
          file: filenameResolved,
          code: codeFromBackend,
          analysis: {
            geminiReview: analysis.geminiReview || { rawReview: '', suggestions: [] },
            suggestions: analysis.suggestions || []
          }
        };
      });

      setFilename(normalizedResults[0]?.file || '');
      setMultiResults(normalizedResults);
    } catch (err) {
      console.error('Multi-file error:', err);
      setError('Failed to analyze files: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ Unified update function to sync editor + results
  const updateFileCode = (idx, newCode) => {
    setMultiResults(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], code: newCode };
      return copy;
    });
    if (multiResults.length === 1) setCode(newCode);
  };

  return (
    <div className="container fade-in">
      {/* HEADER */}
      <div className="header-gradient mb-8">
        <div className="header-content">
          <div className="header-main">
            <div className="header-icon-wrapper">
              <span className="header-icon">🚀</span>
            </div>
            <div className="header-text">
              <h1 className="header-title">
                AI Code Analyzer
                {multiResults.length > 1 && (
                  <span className="multi-file-badge">{multiResults.length} Files</span>
                )}
              </h1>
              <p className="header-subtitle">
                {multiResults.length > 0
                  ? `Analyzing ${multiResults.length} file(s) with AI-powered insights`
                  : 'Transform your code with AI-powered analysis and suggestions'}
              </p>
            </div>
          </div>

          <div className="header-controls">
            <div className="language-selector">
              <label className="control-label">Language:</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="form-select-modern">
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
              </select>
            </div>

            <Link to="/github-callback" className="btn btn-github">
              <span className="github-icon"><FaGithub /></span>
              GitHub Integration
            </Link>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div className="notification error-notification fade-in">
          <span className="notification-icon">❌</span>
          <span className="notification-message">{error}</span>
          <button onClick={() => setError('')} className="notification-close">×</button>
        </div>
      )}
      
      {successMessage && (
        <div className="notification success-notification fade-in">
          <span className="notification-icon">✅</span>
          <span className="notification-message">{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="notification-close">×</button>
        </div>
      )}

      {analysisProgress && (
        <div className="notification progress-notification fade-in">
          <span className="notification-icon">⏳</span>
          <span className="notification-message">{analysisProgress}</span>
          <div className="progress-spinner"></div>
        </div>
      )}

      {/* CODE EDITOR (SINGLE FILE) */}
      {(multiResults.length <= 1) && (
        <div className="editor-container scale-in">
          <div className="editor-header">
            <div className="editor-title-section">
              <span className="editor-icon">💻</span>
              <h3 className="editor-title">{multiResults.length === 1 ? 'Original Code' : 'Code Editor'}</h3>
              {filename && <span className="filename-badge">📄 {filename}</span>}
            </div>
            <div className="editor-stats">
              <span className="stat-item">📊 {String(code).split('\n').length} lines</span>
              <span className="stat-item">📝 {String(code).length} chars</span>
            </div>
          </div>
          <div className="editor-body">
            <CodeEditor code={code} setCode={setCode} language={language} />
          </div>
        </div>
      )}

      {/* ACTIONS + RESULTS */}
      <div className="action-center mb-8">
        <div className="action-grid">
          {/* Analyze Single */}
          <div className="action-card primary-action">
            <div className="action-icon-wrapper"><span className="action-icon">🔍</span></div>
            <div className="action-content">
              <h4 className="action-title">Single File Analysis</h4>
              <button onClick={handleSingleFileAnalyze} disabled={loading || !String(code).trim()} className="action-btn primary">
                {loading ? <>⏳ Analyzing...</> : <>🚀 Analyze Code</>}
              </button>
            </div>
          </div>



          {/* Multi-file Upload */}
          <div className="action-card secondary-action">
            <div className="action-icon-wrapper"><span className="action-icon">📁</span></div>
            <div className="action-content">
              <h4 className="action-title">Multi-File Analysis</h4>
              <input type="file" id="folderInput" style={{ display: 'none' }} {...{ webkitdirectory: "true", directory: "" }} multiple onChange={handleMultiFileUpload} />
              <button onClick={() => document.getElementById('folderInput').click()} disabled={loading} className="action-btn secondary">
                📂 Select Folder
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-FILE EDITOR WITH TABS */}
      {multiResults.length > 1 && (
        <div className="multi-file-editor-container scale-in">
          {/* File Tabs */}
          <div className="file-tabs-container">
            <div className="file-tabs">
              {multiResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => switchToFile(idx)}
                  className={`file-tab ${idx === activeFileIndex ? 'active' : ''}`}
                >
                  <span className="tab-icon">📄</span>
                  <span className="tab-name">{result.file}</span>
                  {result.analysis?.suggestions?.length > 0 && (
                    <span className="tab-badge">{result.analysis.suggestions.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="tab-controls">
              <span className="file-counter">{activeFileIndex + 1} of {multiResults.length}</span>
              <div className="tab-actions">
                <button
                  onClick={() => reAnalyzeSingleFile()}
                  disabled={loading}
                  className="btn btn-sm btn-secondary"
                  title="Re-analyze current file only"
                >
                  {loading ? '⏳' : '�'} Current
                </button>
                <button
                  onClick={reAnalyzeAllFiles}
                  disabled={loading}
                  className="btn btn-sm btn-primary"
                  title="Re-analyze all files"
                >
                  {loading ? '⏳' : '🔄'} All Files
                </button>
              </div>
            </div>
          </div>

          {/* Active File Editor */}
          {getActiveFile() && (
            <div className="active-file-editor">
              <div className="editor-section">
                <div className="editor-header">
                  <div className="editor-title-section">
                    <span className="editor-icon">💻</span>
                    <div className="editor-title-text">
                      <h3 className="editor-title">{getActiveFile().file}</h3>
                      <p className="editor-subtitle">
                        📏 {getActiveFile().code.split('\n').length} lines • 
                        🔍 {getActiveFile().analysis?.suggestions?.length || 0} suggestions •
                        🤖 {getActiveFile().analysis?.geminiReview?.rawReview ? 'AI Review Available' : 'No AI Review'}
                      </p>
                    </div>
                  </div>
                  <div className="editor-controls">
                    <div className="language-display">
                      <span className="language-badge">{detectLanguage(getActiveFile().file)}</span>
                    </div>
                  </div>
                </div>

                <div className="editor-body">
                  <CodeEditor
                    code={getActiveFile().code}
                    setCode={updateActiveFileCode}
                    language={detectLanguage(getActiveFile().file)}
                    filename={getActiveFile().file}
                  />
                </div>
              </div>

              <div className="analysis-section">
                <ResultPanel
                  result={getActiveFile().analysis}
                  code={getActiveFile().code}
                  language={detectLanguage(getActiveFile().file)}
                  setCode={updateActiveFileCode}
                  filename={getActiveFile().file}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SINGLE FILE RESULTS (when only 1 file) */}
      {multiResults.length === 1 && (
        <div className="results-container">
          <div className="result-card fade-in">
            <div className="result-header">
              <div className="file-info">
                <h3 className="file-name">{multiResults[0].file}</h3>
                <span className="single-file-indicator">Single File Analysis</span>
              </div>
            </div>
            <div className="result-content">
              <ResultPanel
                result={multiResults[0].analysis}
                code={multiResults[0].code}
                language={detectLanguage(multiResults[0].file)}
                setCode={updateActiveFileCode}
                filename={multiResults[0].file}
              />
            </div>
          </div>
        </div>
      )}
    {/* </div>
  );
}; */}




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
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .multi-file-badge {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          font-size: 0.875rem;
          font-weight: 600;
          backdrop-filter: blur(10px);
        }

        .header-subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.25rem;
          margin: 0.5rem 0 0 0;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .language-selector {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .control-label {
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .form-select-modern {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: white;
          padding: 0.75rem 1rem;
          font-weight: 500;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .form-select-modern:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.2);
        }

        .form-select-modern option {
          background: #2d3748;
          color: white;
        }

        .btn-github {
          background: linear-gradient(135deg, #24292e, #444d56);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .btn-github:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(36, 41, 46, 0.3);
          text-decoration: none;
          color: white;
        }

        .github-icon {
          font-size: 1.25rem;
        }

        .summary-panel {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .summary-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .summary-icon {
          font-size: 1.5rem;
        }

        .summary-header h3 {
          color: #1e293b;
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .summary-stat {
          text-align: center;
          background: white;
          padding: 1rem;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .stat-number {
          display: block;
          font-size: 2rem;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .editor-container {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          margin-bottom: 2rem;
        }

        .editor-header {
          background: linear-gradient(135deg, #2d3748, #4a5568);
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .editor-title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .editor-icon {
          font-size: 1.5rem;
        }

        .editor-title {
          color: white;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .filename-badge {
          background: rgba(102, 126, 234, 0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          border: 1px solid rgba(102, 126, 234, 0.3);
        }

        .analysis-badge {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-left: 0.5rem;
          animation: pulse 2s infinite;
        }

        .editor-stats {
          display: flex;
          gap: 1.5rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(237, 227, 227, 1);
          font-size: 0.875rem;
        }

        .analysis-ready {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border-radius: 15px;
          padding: 0.25rem 0.75rem;
        }

        .stat-icon {
          font-size: 1rem;
        }

        .action-center {
          padding: 2rem 0;
        }

        .action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .action-card {
          background: linear-gradient(135deg, var(--action-color-start), var(--action-color-end));
          color: white;
          border-radius: 20px;
          padding: 2rem;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .action-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--action-color-start), var(--action-color-end));
        }

        .primary-action {
          --action-color-start: #667eea;
          --action-color-end: #764ba2;
        }

        .secondary-action {
          --action-color-start: #f093fb;
          --action-color-end: #f5576c;
        }

        .tertiary-action {
          --action-color-start: #5581a7ff;
          --action-color-end: #406d7aff;
        }

        .danger-action {
          --action-color-start: #ef4444;
          --action-color-end: #dc2626;
        }

        .action-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .action-icon-wrapper {
          background: rgba(255, 255, 255, 0.2);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
        }

        .action-icon {
          font-size: 2rem;
          color: white;
        }

        .action-title {
          color: white;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
        }

        .action-description {
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        .filename-input {
          margin-bottom: 1rem;
        }

        .filename-field {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 0.9rem;
          backdrop-filter: blur(10px);
        }

        .filename-field::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }

        .filename-field:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.15);
        }

        .action-btn {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          text-decoration: none;
          color: white;
          background: rgba(255, 255, 255, 0.25);
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-btn.danger {
          background: rgba(239, 68, 68, 0.15);
          color: white;
          border: 2px solid rgba(239, 68, 68, 0.3);
        }

        .action-btn.danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
        }

        .spinner {
          width: 16px;
          height: 16px;
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

        .results-container {
          margin-top: 3rem;
        }

        .results-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .results-title {
          color: white;
          font-size: 2rem;
          margin: 0 0 0.5rem 0;
          font-weight: 700;
        }

        .results-subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.1rem;
          margin: 0;
        }

        .result-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
          border-radius: 20px;
          margin-bottom: 2rem;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
        }

        .result-header {
          background: linear-gradient(135deg, #667eea, #764ba2);
          padding: 1.5rem;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .file-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-icon {
          font-size: 2rem;
          background: rgba(255, 255, 255, 0.2);
          padding: 0.75rem;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .file-details h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .file-name {
          color: white;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .single-file-indicator {
          background: rgba(16, 185, 129, 0.2);
          color: #130596ff;
          padding: 0.25rem 0.75rem;
          border-radius: 15px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-left: 0.75rem;
        }

        .file-stats {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .file-stat {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          backdrop-filter: blur(5px);
        }

        .file-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
          backdrop-filter: blur(10px);
        }

        .editor-sync-badge {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .result-content {
          padding: 0;
        }

        .debug-panel {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
          border-radius: 16px;
          margin-top: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
          overflow: hidden;
        }

        .debug-summary {
          cursor: pointer;
          padding: 1.5rem;
          font-weight: 600;
          color: #1e293b;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(248, 250, 252, 0.8);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .debug-summary:hover {
          background: rgba(248, 250, 252, 1);
        }

        .debug-content {
          padding: 1.5rem;
        }

        .debug-section {
          margin-bottom: 1.5rem;
        }

        .debug-section:last-child {
          margin-bottom: 0;
        }

        .debug-section h4 {
          color: #374151;
          margin: 0 0 0.75rem 0;
          font-weight: 600;
        }

        .debug-code {
          background: #1f2937;
          color: #10b981;
          padding: 1rem;
          border-radius: 8px;
          font-size: 0.8rem;
          overflow-x: auto;
          max-height: 300px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          line-height: 1.4;
        }

        .loading-state {
          text-align: center;
          padding: 4rem 0;
        }

        .loading-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
          border-radius: 20px;
          padding: 3rem;
          display: inline-block;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
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
          color: #1e293b;
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }

        .loading-subtitle {
          color: #64748b;
          margin: 0;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 0;
        }

        .empty-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
          border-radius: 20px;
          padding: 3rem;
          display: inline-block;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(10px);
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }

        .empty-title {
          color: #1e293b;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
        }

        .empty-subtitle {
          color: #64748b;
          margin: 0;
          line-height: 1.5;
          max-width: 400px;
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

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
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

          .header-controls {
            justify-content: center;
          }

          .action-grid {
            grid-template-columns: 1fr;
          }

          .editor-header {
            flex-direction: column;
            gap: 1rem;
          }

          .editor-stats {
            justify-content: center;
          }

          .file-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .result-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .summary-stats {
            grid-template-columns: 1fr;
          }

          /* MULTI-FILE TABS MOBILE */
          .file-tabs-container {
            flex-direction: column;
            gap: 1rem;
          }

          .file-tabs {
            flex-direction: column;
            max-height: none;
            overflow: visible;
          }

          .tab-controls {
            justify-content: center;
          }

          .active-file-editor {
            flex-direction: column;
          }

          .editor-section, .analysis-section {
            flex: 1;
          }
        }

        /* ========================================
           MULTI-FILE TAB STYLES
        ======================================== */
        .multi-file-editor-container {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 0;
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          margin-top: 2rem;
        }

        .file-tabs-container {
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .file-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          max-height: 50px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }

        .file-tabs::-webkit-scrollbar {
          height: 6px;
        }

        .file-tabs::-webkit-scrollbar-track {
          background: transparent;
        }

        .file-tabs::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }

        .file-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          min-width: fit-content;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .file-tab:hover {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          transform: translateY(-2px);
        }

        .file-tab.active {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
          transform: translateY(-2px);
        }

        .tab-icon {
          font-size: 1rem;
        }

        .tab-name {
          font-weight: 600;
        }

        .tab-badge {
          background: rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 700;
          min-width: 20px;
          text-align: center;
        }

        .file-tab.active .tab-badge {
          background: rgba(255, 255, 255, 0.4);
        }

        .tab-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .tab-actions {
          display: flex;
          gap: 0.5rem;
        }

        .file-counter {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          font-size: 0.9rem;
        }

        .active-file-editor {
          display: flex;
          min-height: 70vh;
          gap: 0;
        }

        .editor-section {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
        }

        .analysis-section {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border-left: 2px solid rgba(255, 255, 255, 0.1);
        }

        .editor-header {
          background: rgba(0, 0, 0, 1);
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          padding: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .editor-title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .editor-icon {
          font-size: 2rem;
          background: rgba(255, 255, 255, 0.2);
          padding: 0.75rem;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .editor-title-text h3 {
          margin: 0 0 0.5rem 0;
          color: white;
          font-size: 1.4rem;
          font-weight: 700;
        }

        .editor-subtitle {
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          font-size: 0.9rem;
        }

        .language-badge {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .editor-body {
          flex: 1;
          padding: 0;
        }

        /* Button Styles */
        .btn {
          border: none;
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }

        /* ========================================
           NOTIFICATION STYLES
        ======================================== */
        .notification {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 1rem 1.5rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .success-notification {
          background: rgba(16, 185, 129, 0.2);
          border-color: rgba(16, 185, 129, 0.4);
          color: white;
        }

        .error-notification {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: white;
        }

        .progress-notification {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          color: white;
        }

        .progress-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .notification-icon {
          font-size: 1.2rem;
        }

        .notification-message {
          flex: 1;
          font-weight: 600;
        }

        .notification-close {
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          transition: background-color 0.2s ease;
        }

        .notification-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        }
      `}</style>
    </div>
  );
};

export default Editor;