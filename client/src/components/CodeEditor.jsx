import React, { useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { IoMdDownload } from "react-icons/io";

const CodeEditor = ({ code, setCode, language = 'javascript' }) => {
  const editorRef = useRef(null);

  // ✅ Choose language extension
  const getLanguageExtension = (lang) => {
    switch (lang?.toLowerCase()) {
      case 'python': return [python()];
      case 'java': return [java()];
      case 'cpp':
      case 'c++':
      case 'c': return [cpp()];
      case 'javascript':
      case 'js':
      case 'jsx':
      default: return [javascript()];
    }
  };

  // ✅ Download code as file
  const handleDownloadCode = () => {
    if (!code) {
      alert('No code to download!');
      return;
    }
    const fileExt = language === 'python' ? 'py' :
                    language === 'java' ? 'java' :
                    language === 'cpp' ? 'cpp' :
                    language === 'c' ? 'c' :
                    language === 'javascript' ? 'js' : 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_code.${fileExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ✅ Editor extensions and styling
  const extensions = [
    ...getLanguageExtension(language),
    EditorView.theme({
      '&': {
        fontSize: '14px',
        fontFamily: 'Fira Code, Monaco, Cascadia Code, monospace',
      },
      '.cm-content': {
        padding: '16px',
        minHeight: '400px',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-editor': {
        borderRadius: '8px',
      },
      '.cm-scroller': {
        borderRadius: '8px',
      }
    }),
    EditorView.lineWrapping,
  ];

  // ✅ Sync code updates
  useEffect(() => {
    if (editorRef.current && code !== editorRef.current.state.doc.toString()) {
      editorRef.current.dispatch({
        changes: {
          from: 0,
          to: editorRef.current.state.doc.length,
          insert: code || '',
        },
      });
    }
  }, [code]);

  return (
    <div className="code-editor-container fade-in">
      {/* Header */}
      <div className="code-editor-header">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium text-white opacity-80">
            {language?.toUpperCase() || 'CODE'} Editor
          </span>
        </div>

        {/* ✅ Character count + Download button */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-white opacity-60">
            {code?.length || 0} characters
          </div>
          <button onClick={handleDownloadCode} className="btn-download">
            <IoMdDownload />
             Download
          </button>
        </div>
      </div>

      {/* CodeMirror Body */}
      <div className="code-editor-body">
        <CodeMirror
          value={code || ''}
          height="400px"
          theme={oneDark}
          extensions={extensions}
          onChange={(value) => setCode?.(value)}
          placeholder={`// Start typing your code here...\n// The AI will analyze it for improvements and suggestions`}
          onCreateEditor={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>

      {/* Footer */}
      <div className="code-editor-footer">
        <div className="flex items-center justify-between text-xs text-white opacity-70">
          <div className="flex items-center gap-4">
            <span>Lines: {(code || '').split('\n').length}</span>
            <span>Language: {language || 'Auto-detect'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-indicator"></span>
            <span>Ready for analysis</span>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .code-editor-container {
          background: var(--bg-dark);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-large);
          margin-bottom: var(--space-6);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .code-editor-header {
          background: #1a202c;
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid #2d3748;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .btn-download {
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
          transition: 0.2s ease;
        }
        .btn-download:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }

        .code-editor-body {
          position: relative;
        }

        .code-editor-body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--primary-gradient);
          z-index: 1;
        }

        .code-editor-footer {
          background: #1a202c;
          padding: var(--space-3) var(--space-6);
          border-top: 1px solid #2d3748;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          background: #48bb78;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-between { justify-content: space-between; }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .w-3 { width: 0.75rem; }
        .h-3 { height: 0.75rem; }
        .rounded-full { border-radius: 9999px; }
        .bg-red-500 { background-color: #f56565; }
        .bg-yellow-500 { background-color: #ed8936; }
        .bg-green-500 { background-color: #48bb78; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .font-medium { font-weight: 500; }
        .text-white { color: white; }
        .opacity-60 { opacity: 0.6; }
        .opacity-70 { opacity: 0.7; }
        .opacity-80 { opacity: 0.8; }
      `}</style>
    </div>
  );
};

export default CodeEditor;
