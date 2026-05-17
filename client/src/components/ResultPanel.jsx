// ✅ FINAL ResultPanel.jsx — with enhanced CSS for Accept/Reject + Code Blocks
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

// ✅ Smart inline replacement — finds and replaces exact text if found
const applyReplacements = (code, replacements) => {
  let newCode = code;
  replacements.forEach(({ line, newText, from }) => {
    if (from && from.trim()) {
      const fromText = from.trim();
      if (newCode.includes(fromText)) {
        newCode = newCode.replace(fromText, newText.trim());
      }
    } else {
      const lines = newCode.split('\n');
      const i = Number(line) - 1;
      if (i >= 0 && i < lines.length) {
        lines[i] = newText.trim();
        newCode = lines.join('\n');
      }
    }
  });
  return newCode;
};

const standardComments = [
  'Incorrect logic',
  'Syntax error',
  'Poor readability',
  'Missing edge cases',
];

const ResultPanel = ({ result, code, language, setCode, filename }) => {
  const [comment, setComment] = useState('');
  const [selectedStandardComments, setSelectedStandardComments] = useState({});
  const [feedbackStatus, setFeedbackStatus] = useState({});
  const [showRejectOptions, setShowRejectOptions] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  const makeKey = (s, i) =>
    `${s.line || i}-${s.message?.substring(0, 25) || s.title || ''}`;

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const handleFeedback = async (
    suggestion,
    decision,
    autoFixApplied = false,
    index = 0
  ) => {
    const key = makeKey(suggestion, index);
    setFeedbackStatus((p) => ({ ...p, [key]: 'submitting' }));

    const token = await getAccessToken();
    if (!token)
      return setFeedbackStatus((p) => ({ ...p, [key]: 'error' }));

    const combinedComment =
      decision === 'rejected'
        ? [...(selectedStandardComments[key] || []), comment]
            .filter(Boolean)
            .join('; ')
        : '';

    const payload = {
      language,
      originalCode: code,
      suggestionText: suggestion.message || suggestion.title || '',
      action: decision,
      optionalReason: combinedComment,
      autoFixApplied,
      source: suggestion.source || 'static',
      suggestion_type: suggestion.type || 'syntax',
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ` Bearer ${token} `,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      setFeedbackStatus((p) => ({ ...p, [key]: decision }));
      setComment('');
      setSelectedStandardComments((p) => ({ ...p, [key]: [] }));
      setShowRejectOptions((p) => ({ ...p, [key]: false }));
    } catch (err) {
      console.error(err);
      setFeedbackStatus((p) => ({ ...p, [key]: 'error' }));
    }
  };

  // ✅ Updated to prevent duplicate or appended lines
  const handleAutoFix = async (suggestion, index) => {
    if (!setCode) return alert('Editor not linked.');

    const line = suggestion.line;
    const from = suggestion.replacement?.from;
    const to = suggestion.replacement?.to;

    if (!to || !line) {
      return alert('Auto-fix not available for this suggestion.');
    }

    const newCode = applyReplacements(code, [
      { line, from, newText: to },
    ]);
    setCode(newCode);

    await handleFeedback(suggestion, 'accepted', true, index);
  };

  const handleAcceptAll = async (suggestions, label) => {
    const fixable = suggestions.filter((s) => s.replacement?.to);
    if (fixable.length === 0)
      return alert(`No fixable ${label} suggestions found.`);

    const newCode = applyReplacements(
      code,
      fixable.map((s) => ({
        line: s.line,
        from: s.replacement?.from,
        newText: s.replacement?.to,
      }))
    );
    setCode(newCode);

    for (let i = 0; i < fixable.length; i++) {
      await handleFeedback(fixable[i], 'accepted', true, i);
    }
    alert(`✅ ${fixable.length} ${label} suggestions accepted.`);
  };

  const toggleCheckbox = (i, key) => {
    setSelectedStandardComments((p) => {
      const prevArr = p[key] || [];
      const c = standardComments[i];
      return {
        ...p,
        [key]: prevArr.includes(c)
          ? prevArr.filter((x) => x !== c)
          : [...prevArr, c],
      };
    });
  };

  const getSeverityBadgeClasses = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'error':
        return 'bg-red';
      case 'medium':
      case 'warning':
        return 'bg-yellow';
      case 'low':
      case 'info':
        return 'bg-blue';
      default:
        return 'bg-gray';
    }
  };

  const staticSuggestions =
    result?.suggestions?.filter((s) => s.source === 'static') || [];
  const geminiSuggestions =
    result?.suggestions?.filter((s) => s.source === 'gemini') || [];
  const geminiReview =
    result?.geminiReview?.rawReview || 'No Gemini review available.';

  const renderSuggestionCard = (s, i) => {
    const key = makeKey(s, i);
    const status = feedbackStatus[key];

    return (
      <div key={i} className="suggestion-card">
        <div className="suggestion-header">
          <h4>
            Line {s.line || 'N/A'} — {s.symbol || s.type}
          </h4>
          <span className={`severity ${getSeverityBadgeClasses(s.severity)}`}>
            {s.severity || 'Medium'}
          </span>
        </div>
        <p className="suggestion-message">{s.message}</p>

        {s.replacement?.from && (
          <pre className="code-block original">
            {s.replacement.from}
          </pre>
        )}
        {s.replacement?.to && (
          <pre className="code-block suggested">
            {s.replacement.to}
          </pre>
        )}

        <div className="action-buttons">
          <button
            onClick={() => handleAutoFix(s, i)}
            className="btn-accept"
            disabled={status === 'submitting'}
          >
            {status === 'submitting'
              ? '⏳ Applying...'
              : '✅ Accept & Apply'}
          </button>
          <button
            onClick={() =>
              setShowRejectOptions((p) => ({
                ...p,
                [key]: !p[key],
              }))
            }
            className="btn-reject"
            disabled={status === 'submitting'}
          >
            ❌ Reject
          </button>
        </div>

        {showRejectOptions[key] && (
          <div className="reject-box">
            <h4>🤔 Why reject?</h4>
            {standardComments.map((c, idx) => (
              <label key={idx}>
                <input
                  type="checkbox"
                  checked={(selectedStandardComments[key] || []).includes(
                    c
                  )}
                  onChange={() => toggleCheckbox(idx, key)}
                />
                {c}
              </label>
            ))}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Additional reason..."
            />
            <button
              onClick={() =>
                handleFeedback(s, 'rejected', false, i)
              }
              className="btn-submit-reject"
              disabled={status === 'submitting'}
            >
              📝 Submit Rejection
            </button>
          </div>
        )}

        {status === 'accepted' && (
          <p className="status success">
            ✅ Accepted successfully!
          </p>
        )}
        {status === 'rejected' && (
          <p className="status rejected">
            ❌ Rejected and recorded
          </p>
        )}
        {status === 'error' && (
          <p className="status error">
            ⚠ Error submitting feedback
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="result-panel">
      {geminiReview && (
        <div className="gemini-review">
          <h2>✨ Gemini Review Summary</h2>
          <p>{geminiReview}</p>
        </div>
      )}

      {geminiSuggestions.length > 0 && (
        <div className="suggestion-section gemini">
          <div className="section-header">
            <h3>🤖 Gemini Suggestions</h3>
            <button
              onClick={() => handleAcceptAll(geminiSuggestions, 'Gemini')}
              className="btn-accept-all"
            >
              ✅ Accept All
            </button>
          </div>
          {geminiSuggestions.map(renderSuggestionCard)}
        </div>
      )}

      {staticSuggestions.length > 0 && (
        <div className="suggestion-section static">
          <div className="section-header">
            <h3>⚡ Static Suggestions</h3>
            <button
              onClick={() => handleAcceptAll(staticSuggestions, 'Static')}
              className="btn-accept-all"
            >
              ✅ Accept All
            </button>
          </div>
          {staticSuggestions.map(renderSuggestionCard)}
        </div>
      )}

      {/* ✅ Added Stylish CSS */}
      <style>{`
        .result-panel {
          font-family: 'Poppins', sans-serif;
          margin-top: 1.5rem;
        }
        .gemini-review {
          background: linear-gradient(135deg, #f3e8ff, #e0f2fe);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        }
        .gemini-review h2 {
          color: #6d28d9;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .suggestion-section {
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 30px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.05);
        }
        .suggestion-section.gemini {
          background: linear-gradient(135deg, #eef5ff, #f6f9ff);
        }
        .suggestion-section.static {
          background: linear-gradient(135deg, #fff9e6, #fffef3);
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .btn-accept-all {
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          padding: 8px 14px;
          cursor: pointer;
          transition: 0.3s;
        }
        .btn-accept-all:hover { opacity: 0.85; }
        .suggestion-card {
          background: white;
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 20px;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .suggestion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .suggestion-header h4 {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        .severity {
          font-size: 12px;
          font-weight: 600;
          border-radius: 12px;
          padding: 3px 10px;
        }
        .bg-red { background: #fee2e2; color: #991b1b; }
        .bg-yellow { background: #fef3c7; color: #92400e; }
        .bg-blue { background: #dbeafe; color: #1e40af; }
        .code-block {
          font-family: monospace;
          border-radius: 8px;
          padding: 10px;
          white-space: pre-wrap;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .code-block.original {
          background: #fff5f5;
          border-left: 4px solid #f87171;
          color: #991b1b;
        }
        .code-block.suggested {
          background: #f0fdf4;
          border-left: 4px solid #10b981;
          color: #065f46;
        }
        .action-buttons {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        .btn-accept {
          flex: 1;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 0;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(34,197,94,0.3);
          transition: 0.3s;
        }
        .btn-reject {
          flex: 1;
          background: linear-gradient(90deg, #ef4444, #b91c1c);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 0;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(239,68,68,0.3);
          transition: 0.3s;
        }
        .btn-accept:hover, .btn-reject:hover { opacity: 0.85; }
        .reject-box {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 10px;
          padding: 10px;
          margin-top: 10px;
        }
        .reject-box textarea {
          width: 100%;
          margin-top: 6px;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 6px;
          font-size: 13px;
          color: #78350f;
        }
        .btn-submit-reject {
          margin-top: 8px;
          background: linear-gradient(90deg,#f97316,#ea580c);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .status {
          margin-top: 6px;
          font-weight: 600;
        }
        .status.success { color: #15803d; }
        .status.rejected { color: #b91c1c; }
        .status.error { color: #b45309; }
      `}</style>
    </div>
  );
};

export default ResultPanel;