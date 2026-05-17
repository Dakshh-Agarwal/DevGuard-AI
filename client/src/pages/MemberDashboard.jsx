// MemberDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { teamsAPI, feedbackAPI, ApiError } from "../utils/api";

/**
 * Inline-styled Member Dashboard
 * - All styles are inline so global CSS / Tailwind won't override them.
 * - Hover glows use small JS handlers to update style (works reliably).
 * - Font set to "Poppins" but falls back to sans-serif.
 */

/* ---------- Shared style objects ---------- */
const fontFamily = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    paddingBottom: "4rem",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
    color: "#FFFFFF",
    fontFamily,
    paddingTop: "24px",
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    position: "relative",
    zIndex: 10,
    paddingBottom: "4rem",
  },
  glassCard: {
    position: "relative",
    background: "rgba(17,25,40,0.78)",
    backdropFilter: "blur(12px)",
    borderRadius: 20,
    padding: "20px",
    border: "1px solid rgba(148,163,184,0.12)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    transition: "transform 0.32s ease, box-shadow 0.32s ease",
  },
  headerIconCircle: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #06b6d4 100%)",
    boxShadow: "0 8px 32px rgba(59,130,246,0.12)",
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.03,
    margin: "12px 0",
    textAlign: "center",
    background: "linear-gradient(90deg,#a78bfa,#f472b6,#60a5fa)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  subtitle: {
    fontSize: 16,
    color: "#cbd5e1",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: 500,
  },
  badge: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    marginRight: 8,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
    marginBottom: 32,
  },
  statCard: {
    position: "relative",
    padding: 22,
    borderRadius: 16,
    overflow: "hidden",
    textAlign: "center",
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(148,163,184,0.08)",
    boxShadow: "0 8px 24px rgba(2,6,23,0.6)",
    transition: "transform 0.28s ease, box-shadow 0.28s ease",
  },
  progressBarOuter: {
    height: 8,
    background: "rgba(30,41,59,0.6)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },
  progressBarInner: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.5s ease",
    background: "linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    color: "#fff",
  },
  tableHeaderCell: {
    textAlign: "left",
    padding: "14px 12px",
    color: "#cbd5e1",
    fontWeight: 700,
    fontSize: 14,
    borderBottom: "1px solid rgba(148,163,184,0.06)",
  },
  tableRow: {
    transition: "background 0.18s ease, transform 0.18s ease",
  },
  pill: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "none",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    borderRadius: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
    color: "#fff",
    boxShadow: "0 8px 28px rgba(99,102,241,0.18)",
    transition: "transform 0.18s ease",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    borderRadius: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(255,255,255,0.02)",
    color: "#e6eef8",
  },
  smallMuted: {
    color: "#94a3b8",
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
    resize: "vertical",
  },
  animatedBgCircle: (extra = {}) => ({
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(28px)",
    mixBlendMode: "screen",
    opacity: 0.18,
    ...extra,
  }),
};

/* ---------- small helpers for interactive hover glows ---------- */
function attachHoverTransformHandlers() {
  return {
    onMouseEnter: (e) => {
      try {
        e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
        e.currentTarget.style.boxShadow = "0 14px 34px rgba(0,0,0,0.6)";
      } catch (err) {}
    },
    onMouseLeave: (e) => {
      try {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
      } catch (err) {}
    },
  };
}

/* ---------- FeedbackSubmissionForm (inline styles) ---------- */
const FeedbackSubmissionForm = ({ teamMembers = [], currentUserId, teamId, onFeedbackSubmitted }) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("general");
  const [comments, setComments] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const otherMembers = (teamMembers || []).filter((m) => m.user_id !== currentUserId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMember || !rating || !comments.trim()) {
      setSubmitMessage("❌ Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    setSubmitMessage("");
    try {
      const feedbackData = {
        team_id: teamId,
        reviewee_id: selectedMember,
        rating: parseInt(rating),
        category,
        comments: comments.trim(),
        suggestions: suggestions.trim(),
      };
      await feedbackAPI.submitPeerFeedback(feedbackData);
      setSelectedMember("");
      setRating(5);
      setCategory("general");
      setComments("");
      setSuggestions("");
      setSubmitMessage("✅ Feedback submitted successfully!");
      if (onFeedbackSubmitted) onFeedbackSubmitted();
      setTimeout(() => setSubmitMessage(""), 3000);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setSubmitMessage(`❌ ${err?.message || "Failed to submit feedback"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMemberInfo = otherMembers.find((m) => m.user_id === selectedMember);

  return (
    <div style={{ display: "block", gap: 12 }}>
      {submitMessage && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
            fontWeight: 700,
            marginBottom: 12,
            color: submitMessage.includes("✅") ? "#bbf7d0" : "#fecaca",
            background: submitMessage.includes("✅") ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          }}
        >
          {submitMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {/* grid of two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>👤 Select Team Member *</label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              style={{ ...styles.input }}
              required
            >
              <option value="">Choose a team member...</option>
              {otherMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_profile?.full_name ||
                    member.user_profile?.username ||
                    member.user_profile?.email?.split?.("@")?.[0] ||
                    `Member ${member.user_id?.substring(0, 8)}`}
                  {member.role === "owner" ? " (Owner)" : ""}
                </option>
              ))}
            </select>

            {selectedMemberInfo && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(99,102,241,0.08)",
                  background: "rgba(79,70,229,0.06)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      color: "#fff",
                      fontWeight: 800,
                    }}
                  >
                    {(selectedMemberInfo.user_profile?.full_name?.charAt(0) ||
                      selectedMemberInfo.user_profile?.email?.charAt(0) ||
                      "?"
                    ).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff" }}>
                      {selectedMemberInfo.user_profile?.full_name ||
                        selectedMemberInfo.user_profile?.username ||
                        "Team Member"}
                    </div>
                    <div style={{ fontSize: 12, color: "#c7d2fe" }}>
                      {selectedMemberInfo.user_profile?.email || selectedMemberInfo.user_id}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>⭐ Rating *</label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              style={{ ...styles.input }}
              required
            >
              <option value={5}>⭐⭐⭐⭐⭐ Excellent (5)</option>
              <option value={4}>⭐⭐⭐⭐ Good (4)</option>
              <option value={3}>⭐⭐⭐ Average (3)</option>
              <option value={2}>⭐⭐ Below Average (2)</option>
              <option value={1}>⭐ Needs Improvement (1)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>🏷️ Feedback Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...styles.input }}>
            <option value="general">💬 General Feedback</option>
            <option value="code_quality">💻 Code Quality</option>
            <option value="collaboration">🤝 Collaboration</option>
            <option value="communication">📞 Communication</option>
            <option value="problem_solving">🧠 Problem Solving</option>
            <option value="leadership">👑 Leadership</option>
            <option value="creativity">🎨 Creativity</option>
            <option value="performance">📈 Performance</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
            💬 Comments *{" "}
            <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>
              (Share your thoughts and feedback)
            </span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            placeholder="Describe their performance, collaboration, contributions, or areas of excellence..."
            style={{ ...styles.textarea }}
            required
          />
          <div style={{ textAlign: "right", color: "#94a3b8", fontSize: 13 }}>{comments.length}/500 characters</div>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
            💡 Suggestions for Improvement{" "}
            <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>
              (Optional constructive feedback)
            </span>
          </label>
          <textarea
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            rows={3}
            placeholder="Optional: Suggest areas where they could improve or grow further..."
            style={{ ...styles.textarea }}
          />
          <div style={{ textAlign: "right", color: "#94a3b8", fontSize: 13 }}>{suggestions.length}/300 characters</div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <button
            type="submit"
            disabled={isSubmitting || !selectedMember || !comments.trim()}
            style={{
              ...styles.btnPrimary,
              opacity: isSubmitting || !selectedMember || !comments.trim() ? 0.6 : 1,
              cursor: isSubmitting || !selectedMember || !comments.trim() ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: 18, borderTop: "2px solid rgba(255,255,255,0.9)", animation: "spin 1s linear infinite" }} />
                Submitting Feedback...
              </div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>📝 Submit Feedback</div>
            )}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.06)" }}>
        <h4 style={{ color: "#bfdbfe", fontWeight: 700, marginBottom: 8 }}>ℹ️ Feedback Guidelines</h4>
        <ul style={{ color: "#bfdbfe", fontSize: 13, lineHeight: 1.6 }}>
          <li>• Be constructive and specific in your feedback</li>
          <li>• Focus on behaviors and work quality, not personal traits</li>
          <li>• Highlight both strengths and areas for improvement</li>
          <li>• Keep feedback professional and respectful</li>
          <li>• Your feedback will help improve team collaboration and performance</li>
        </ul>
      </div>
    </div>
  );
};

/* ---------- MemberDashboard main component ---------- */
const MemberDashboard = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [teamInfo, setTeamInfo] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [myFeedback, setMyFeedback] = useState([]);
  const [receivedFeedback, setReceivedFeedback] = useState([]);
  const [myStats, setMyStats] = useState({
    totalFeedback: 0,
    avgRating: 0,
    recentActivity: 0,
    acceptanceRate: 0,
  });
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState(null);
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  // small ref to avoid state update on unmounted
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  useEffect(() => {
    if (!teamId) return;
    fetchMemberData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

 const fetchMemberData = async () => {
  try {
    setLoading(true);
    setError(null);

    // Check auth
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    // team info
    try {
      const teamInfoResponse = await teamsAPI.getTeamInfo(teamId);
      if (!mountedRef.current) return;
      setTeamInfo(teamInfoResponse.team);
      setMemberInfo(teamInfoResponse.memberInfo);
    } catch (err) {
      if (err?.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      throw err;
    }

    // ✅ members (fixed)
// ✅ Fetch teammates (with names + stats)
// ✅ Optimized fetch teammates (with names + stats since joining)
try {
  // Step 1: get all team members for this team
  const { data: memberRows, error: teamErr } = await supabase
    .from("team_members")
    .select("user_id, role, joined_at")
    .eq("team_id", teamId);

  if (teamErr) throw teamErr;
  if (!memberRows?.length) {
    setTeamMembers([]);
    return;
  }

  const userIds = memberRows.map((m) => m.user_id);

  // Step 2: fetch all profiles for these users
  const { data: profileRows, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, username, email")
    .in("id", userIds);

  if (profileErr) throw profileErr;

  // Step 3: fetch all feedback in this team
  const { data: feedbackRows, error: feedbackErr } = await supabase
    .from("team_feedback")
    .select("reviewer_id, reviewee_id, rating, created_at")
    .eq("team_id", teamId);

  if (feedbackErr) throw feedbackErr;

  // Step 4: compute stats per member
  const statsMap = {};

  userIds.forEach((id) => {
    const given = feedbackRows.filter((f) => f.reviewer_id === id);
    const received = feedbackRows.filter((f) => f.reviewee_id === id);

    const totalFeedback = given.length;

    const avgRating =
      received.length > 0
        ? received.reduce((sum, f) => sum + (f.rating || 0), 0) /
          received.length
        : 0;

    // ✅ Activity since joining the team
    const joinedDate = new Date(
      memberRows.find((m) => m.user_id === id)?.joined_at
    );

    const activitySinceJoined = given.filter(
      (f) => new Date(f.created_at) >= joinedDate
    ).length;

    statsMap[id] = {
      totalFeedback,
      acceptanceRate: Math.round(avgRating * 20), // convert 5★ scale to %
      recentActivity: activitySinceJoined,
    };
  });

  // Step 5: merge profiles + stats into final array
  const formattedMembers = memberRows.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    user_profile: profileRows.find((p) => p.id === m.user_id) || {},
    stats: statsMap[m.user_id] || {
      totalFeedback: 0,
      acceptanceRate: 0,
      recentActivity: 0,
    },
  }));

  setTeamMembers(formattedMembers);
} catch (err) {
  console.error("Error fetching members:", err);
  if (mountedRef.current) setTeamMembers([]);
}


    // my feedback
    try {
      const feedbackResponse = await teamsAPI.getMyFeedback(teamId);
      if (!mountedRef.current) return;
      setMyFeedback(feedbackResponse.feedback || []);
      setMyStats({
        totalFeedback: feedbackResponse.stats?.totalFeedback || 0,
        avgRating: feedbackResponse.stats?.avgRating || 0,
        recentActivity: feedbackResponse.stats?.recentActivity || 0,
        acceptanceRate: feedbackResponse.stats?.acceptanceRate || 0,
      });
    } catch (err) {
      console.error("Error fetching my feedback:", err);
      if (mountedRef.current) {
        setMyFeedback([]);
        setMyStats({
          totalFeedback: 0,
          avgRating: 0,
          recentActivity: 0,
          acceptanceRate: 0,
        });
      }
    }

    // received feedback
    try {
      const rec = await feedbackAPI.getReceivedFeedback(teamId);
      if (!mountedRef.current) return;
      setReceivedFeedback(rec || []);
    } catch (err) {
      console.error("Error fetching received feedback:", err);
      if (mountedRef.current) setReceivedFeedback([]);
    }
  } catch (err) {
    console.error("Error fetching member data:", err);
    if (err instanceof ApiError && err.status === 401) {
      navigate("/login");
    } else {
      setError(err?.message || "Failed to load dashboard data");
    }
  } finally {
    if (mountedRef.current) setLoading(false);
  }
};


  const handleLeaveTeam = () => setShowLeaveConfirmation(true);

  const confirmLeaveTeam = async () => {
    try {
      setIsLeavingTeam(true);
      setError(null);
      await teamsAPI.leaveTeam(teamId);
      navigate("/teams");
    } catch (err) {
      console.error("Error leaving team:", err);
      setError(err?.message || "Failed to leave team. Please try again.");
    } finally {
      setIsLeavingTeam(false);
      setShowLeaveConfirmation(false);
    }
  };

  const cancelLeaveTeam = () => setShowLeaveConfirmation(false);

  // Loading screen
  if (loading) {
    return (
      <div style={{ ...styles.page }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ ...styles.glassCard, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto", marginBottom: 12, border: "4px solid rgba(99,102,241,0.12)" }}>
              <div style={{ width: 32, height: 32, margin: "8px auto", borderTop: "3px solid rgba(255,255,255,0.9)", borderRadius: 999, animation: "spin 1s linear infinite" }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Loading Dashboard</div>
            <div style={{ color: "#cbd5e1" }}>Please wait while we fetch your team information...</div>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ ...styles.page }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ ...styles.glassCard, textAlign: "center", maxWidth: 540 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🚫</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Access Denied</h2>
            <p style={{ color: "#cbd5e1", marginBottom: 16 }}>
              You are not a member of this team. Please join the team first or check if you have the correct team link.
            </p>
            <Link to="/teams" style={{ textDecoration: "none" }}>
              <div style={{ ...styles.btnPrimary, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }}>Back to Teams</div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- small render helpers ---------- */
  const renderStatCard = (icon, value, label, gradient) => {
    const hoverHandlers = attachHoverTransformHandlers();
    return (
      <div style={{ ...styles.statCard }} {...hoverHandlers}>
        <div style={{ width: 56, height: 56, margin: "0 auto 10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: gradient }}>
          <div style={{ fontSize: 20 }}>{icon}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{value}</div>
        <div style={{ color: "#94a3b8", fontWeight: 600 }}>{label}</div>
      </div>
    );
  };

  const renderFeedbackRow = (feedback, index) => {
    const statusColor =
      feedback.decision === "accepted" ? "linear-gradient(90deg,#34d399,#10b981)" :
      feedback.decision === "rejected" ? "linear-gradient(90deg,#fb7185,#ef4444)" :
      "linear-gradient(90deg,#94a3b8,#64748b)";

    const statusText =
      feedback.decision === "accepted" ? "✅ Accepted" :
      feedback.decision === "rejected" ? "❌ Rejected" :
      "⏳ Pending";

    return (
      <tr key={feedback.id || index} style={{ ...styles.tableRow }}>
        {/* Decision Status */}
        <td style={{ padding: "18px", verticalAlign: "top", width: 140 }}>
          <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 999, background: statusColor, color: "#fff", fontWeight: 700 }}>
            {statusText}
          </div>
        </td>

        {/* Suggestion Type */}
        <td style={{ padding: "18px", verticalAlign: "top", width: 140 }}>
          <div style={{ display: "inline-block", padding: "6px 10px", borderRadius: 12, background: "rgba(59,130,246,0.06)", color: "#bfdbfe", fontWeight: 700 }}>
            {feedback.suggestion_type || "General"}
          </div>
        </td>

        {/* Date */}
        <td style={{ padding: "18px", verticalAlign: "top", width: 140, textAlign: "center" }}>
          <div style={{ display: "inline-block", padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontWeight: 700, color: "#e6eef8" }}>{new Date(feedback.created_at).toLocaleDateString()}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{new Date(feedback.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </td>

        {/* Suggestion */}
        <td style={{ padding: "18px", verticalAlign: "top", maxWidth: 320 }}>
          {feedback.suggestion ? (
            <div
              style={{
                borderRadius: 12,
                padding: 12,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.06)",
              }}
            >
              <div style={{ color: "#e6eef8", fontSize: 14 }}>
                {feedback.suggestion.length > 120
                  ? feedback.suggestion.substring(0, 120) + "…"
                  : feedback.suggestion}
              </div>
            </div>
          ) : (
            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No suggestion</span>
          )}
        </td>

        {/* Comment */}
        <td style={{ padding: "18px", verticalAlign: "top", maxWidth: 300 }}>
          {feedback.comment ? (
            <div
              style={{
                borderRadius: 12,
                padding: 12,
                background: "rgba(236,72,153,0.04)",
                border: "1px solid rgba(236,72,153,0.04)",
              }}
            >
              <div style={{ color: "#e6eef8", fontSize: 14 }}>
                {feedback.comment.length > 100
                  ? feedback.comment.substring(0, 100) + "…"
                  : feedback.comment}
              </div>
            </div>
          ) : (
            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No comment</span>
          )}
        </td>

        {/* Submitted By (Team Member) */}
        <td style={{ padding: "18px", verticalAlign: "top", width: 220 }}>
          <div
            style={{
              borderRadius: 12,
              padding: 10,
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {(feedback.user_profile?.full_name?.charAt(0) ||
                feedback.user_profile?.username?.charAt(0) ||
                feedback.user_profile?.email?.charAt(0) ||
                feedback.email?.charAt(0) ||
                "?"
              ).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#e6eef8" }}>
                {feedback.user_profile?.full_name ||
                  feedback.user_profile?.username ||
                  feedback.email ||
                  "Team Member"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {feedback.user_profile?.email || feedback.email || "Unknown"}
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };
  /* ---------- main JSX ---------- */
  return (
    <div style={{ ...styles.page }}>
      {/* animated background circles */}
      <div style={styles.animatedBgCircle({ top: "-120px", right: "-120px", width: 320, height: 320, background: "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.85), rgba(59,130,246,0.6))" })} />
      <div style={styles.animatedBgCircle({ bottom: "-120px", left: "-120px", width: 300, height: 300, background: "radial-gradient(circle at 60% 60%, rgba(16,185,129,0.85), rgba(34,197,94,0.4))" })} />
      <div style={styles.container}>
        {/* header card */}
        <div style={{ ...styles.glassCard, marginBottom: 28, textAlign: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={styles.headerIconCircle}>
              <div style={{ fontSize: 28 }}>👤</div>
            </div>
            <h1 style={{ ...styles.title }}>Member Dashboard</h1>
            <div style={{ ...styles.subtitle }}>
              {teamInfo ? (
                <span>
                  ✨ Welcome to <span style={{ color: "#60a5fa", fontWeight: 800 }}>"{teamInfo.team_name}"</span> ✨
                </span>
              ) : (
                `Team ${teamId}`
              )}
            </div>

            {memberInfo && (
              <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ ...styles.badge, background: memberInfo.role === "owner" ? "linear-gradient(90deg,#f59e0b,#fb923c)" : memberInfo.role === "lead" ? "linear-gradient(90deg,#3b82f6,#6366f1)" : "linear-gradient(90deg,#8b5cf6,#ec4899)", color: "#fff" }}>
                  {memberInfo.role === "owner" ? "👑 Team Owner" : memberInfo.role === "lead" ? "⭐ Team Lead" : "👤 Member"}
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: 999, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ color: "#34d399" }}>📅</div>
                  <div style={{ fontSize: 13 }}>Joined {new Date(memberInfo.joined_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* stats cards */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            <div style={{ ...styles.statCard }} {...attachHoverTransformHandlers()}>
              <div style={{ width: 56, height: 56, margin: "0 auto 10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#60a5fa,#8b5cf6)" }}>
                <div style={{ fontSize: 20 }}>📈</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{myStats.totalFeedback}</div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>My Feedback Submitted</div>
              <div style={{ ...styles.progressBarOuter }}>
                <div style={{ ...styles.progressBarInner, width: `${Math.min((myStats.totalFeedback / 20) * 100, 100)}%` }} />
              </div>
            </div>

            <div style={{ ...styles.statCard }} {...attachHoverTransformHandlers()}>
              <div style={{ width: 56, height: 56, margin: "0 auto 10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#34d399,#10b981)" }}>
                <div style={{ fontSize: 20 }}>✅</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{myStats.acceptanceRate}%</div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>My Acceptance Rate</div>
              <div style={{ ...styles.progressBarOuter }}>
                <div style={{ ...styles.progressBarInner, width: `${myStats.acceptanceRate}%` }} />
              </div>
            </div>

            <div style={{ ...styles.statCard }} {...attachHoverTransformHandlers()}>
              <div style={{ width: 56, height: 56, margin: "0 auto 10px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#fb923c,#ef4444)" }}>
                <div style={{ fontSize: 20 }}>🔥</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{myStats.recentActivity}</div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>My Recent Activity (7 days)</div>
              <div style={{ ...styles.progressBarOuter }}>
                <div style={{ ...styles.progressBarInner, width: `${Math.min((myStats.recentActivity / 10) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Feedback */}
        <div style={{ marginBottom: 30, ...styles.glassCard }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(99,102,241,0.12)" }}>
                📝
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e6eef8" }}>Team Code Review Feedback</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>All team feedback with accept/reject status</div>
              </div>
            </div>

            <div style={{ background: "rgba(99,102,241,0.04)", padding: "8px 14px", borderRadius: 999, fontWeight: 700, color: "#c7d2fe" }}>
              ✨ {myFeedback.length} Total Entries
            </div>
          </div>

          {myFeedback.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: 12 }}>
              <table style={{ ...styles.table }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableHeaderCell }}>📊 Decision</th>
                    <th style={{ ...styles.tableHeaderCell }}>🏷️ Type</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>📅 Date</th>
                    <th style={{ ...styles.tableHeaderCell }}>💡 Suggestion</th>
                    <th style={{ ...styles.tableHeaderCell }}>💬 Comment</th>
                    <th style={{ ...styles.tableHeaderCell }}>👤 Submitted By</th>
                  </tr>
                </thead>
                <tbody>
                  {myFeedback.slice(0, 10).map((f, idx) => renderFeedbackRow(f, idx))}
                </tbody>
              </table>

              {myFeedback.length > 10 && (
                <div style={{ textAlign: "center", padding: 12, color: "#cbd5e1" }}>
                  Showing 10 of {myFeedback.length} total feedback entries
                </div>
              )}

              {/* Team Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 18 }}>
                <div style={{ borderRadius: 10, padding: 12, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#34d399" }}>
                    {myFeedback.filter(f => f.decision === 'accepted').length}
                  </div>
                  <div style={{ color: "#bbf7d0", fontSize: 13 }}>✅ Accepted</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fb7185" }}>
                    {myFeedback.filter(f => f.decision === 'rejected').length}
                  </div>
                  <div style={{ color: "#fecaca", fontSize: 13 }}>❌ Rejected</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(148,163,184,0.04)", border: "1px solid rgba(148,163,184,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#94a3b8" }}>
                    {myFeedback.filter(f => !f.decision || f.decision === 'pending').length}
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>⏳ Pending</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>No Code Review Feedback</div>
              <div style={{ color: "#94a3b8", marginBottom: 14 }}>No team members have submitted code review feedback yet</div>
              <div style={{ background: "rgba(99,102,241,0.04)", padding: 14, borderRadius: 12 }}>
                <div style={{ fontWeight: 700, color: "#c7d2fe", marginBottom: 6 }}>💡 How it works</div>
                <div style={{ color: "#c7d2fe" }}>Team members can submit code for review, and reviewers can accept or reject suggestions. All team feedback will appear here showing who submitted it and the decision status.</div>
              </div>
            </div>
          )}
        </div>

        {/* Give Feedback section */}
        <div style={{ marginBottom: 30, ...styles.glassCard }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#10b981,#34d399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                💝
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e6eef8" }}>Give Feedback to Team Members</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Peer Review</div>
              </div>
            </div>

            <div style={{ background: "rgba(16,185,129,0.04)", padding: "8px 14px", borderRadius: 999, fontWeight: 700, color: "#bbf7d0" }}>
              🎯 Peer Review
            </div>
          </div>

          <FeedbackSubmissionForm
            teamMembers={teamMembers}
            currentUserId={memberInfo?.user_id}
            teamId={teamId}
            onFeedbackSubmitted={fetchMemberData}
          />
        </div>

        {/* Received feedback */}
        <div style={{ marginBottom: 30, ...styles.glassCard }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#8b5cf6,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                📥
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e6eef8" }}>Feedback Received from Team</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>All reviews you've gotten</div>
              </div>
            </div>

            <div style={{ background: "rgba(139,92,246,0.04)", padding: "8px 14px", borderRadius: 999, fontWeight: 700, color: "#d8b4fe" }}>
              ⭐ {receivedFeedback.length} Reviews
            </div>
          </div>

          {receivedFeedback.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...styles.table }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableHeaderCell }}>👤 From</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>⭐ Rating</th>
                    <th style={{ ...styles.tableHeaderCell }}>🏷️ Category</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>📅 Date</th>
                    <th style={{ ...styles.tableHeaderCell }}>💬 Comments</th>
                    <th style={{ ...styles.tableHeaderCell }}>💡 Suggestions</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedFeedback.map((f, idx) => (
                    <tr key={f.id || idx} style={{ ...styles.tableRow }}>
                      <td style={{ padding: 14 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 999, background: "linear-gradient(135deg,#8b5cf6,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
                            {(f.reviewer_profile?.full_name?.charAt(0) || f.reviewer_profile?.email?.charAt(0) || "?").toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{f.reviewer_profile?.full_name || f.reviewer_profile?.username || "Team Member"}</div>
                            <div style={{ color: "#94a3b8", fontSize: 13 }}>{f.reviewer_profile?.email || "Unknown"}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: 14, textAlign: "center" }}>
                        <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, background: f.rating >= 4 ? "rgba(34,197,94,0.06)" : f.rating >= 3 ? "rgba(250,204,21,0.06)" : "rgba(248,113,113,0.06)", color: f.rating >= 4 ? "#bbf7d0" : f.rating >= 3 ? "#fde68a" : "#fecaca", fontWeight: 700 }}>
                          {"⭐".repeat(Math.max(0, Math.min(5, f.rating || 0)))} ({f.rating || 0}/5)
                        </div>
                      </td>

                      <td style={{ padding: 14 }}>
                        <div style={{ display: "inline-block", padding: "6px 10px", borderRadius: 999, background: "rgba(59,130,246,0.04)", color: "#bfdbfe", fontWeight: 700 }}>
                          {f.category ? f.category.charAt(0).toUpperCase() + f.category.slice(1).replace("_", " ") : "General"}
                        </div>
                      </td>

                      <td style={{ padding: 14, textAlign: "center" }}>
                        <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                          <div style={{ fontWeight: 700 }}>{new Date(f.created_at).toLocaleDateString()}</div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>{new Date(f.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </td>

                      <td style={{ padding: 14 }}>
                        {f.comments ? (
                          <div style={{ borderRadius: 10, padding: 10, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.04)" }}>
                            <div style={{ color: "#e6eef8" }}>{f.comments.length > 140 ? f.comments.substring(0, 140) + "…" : f.comments}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No comments</span>
                        )}
                      </td>

                      <td style={{ padding: 14 }}>
                        {f.suggestions ? (
                          <div style={{ borderRadius: 10, padding: 10, background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.04)" }}>
                            <div style={{ color: "#e6eef8" }}>{f.suggestions.length > 120 ? f.suggestions.substring(0, 120) + "…" : f.suggestions}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No suggestions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 18 }}>
                <div style={{ borderRadius: 10, padding: 12, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedFeedback.length > 0 ? (receivedFeedback.reduce((s, r) => s + (r.rating || 0), 0) / receivedFeedback.length).toFixed(1) : "N/A"}</div>
                  <div style={{ color: "#bbf7d0" }}>Average Rating</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedFeedback.length}</div>
                  <div style={{ color: "#bfdbfe" }}>Total Reviews</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedFeedback.filter((f) => f.rating >= 4).length}</div>
                  <div style={{ color: "#d8b4fe" }}>Positive Reviews</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 22, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No Feedback Received</div>
              <div style={{ color: "#94a3b8", marginBottom: 12 }}>You haven't received any feedback from team members yet</div>
              <div style={{ background: "rgba(139,92,246,0.04)", padding: 12, borderRadius: 10 }}>
                <div style={{ color: "#d8b4fe" }}>💡 Tip: Actively participate in team activities and code reviews to receive valuable feedback from peers</div>
              </div>
            </div>
          )}
        </div>

        {/* Team Members */}
        {/* <div style={{ marginBottom: 30, ...styles.glassCard }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>👥</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#e6eef8" }}>Team Members ({teamMembers.length})</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Quick team overview</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(250,204,21,0.06)", color: "#f59e0b", fontWeight: 700 }}>👑 1 Owner</div>
              <div style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(59,130,246,0.04)", color: "#60a5fa", fontWeight: 700 }}>👤 {teamMembers.filter((m) => m.role !== "owner").length} Members</div>
            </div>
          </div>

          {/* owner card */}
          {/* {(() => {
            const owner = teamMembers.find((m) => m.role === "owner");
            if (!owner) {
              return <div style={{ color: "#fecaca", padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.04)" }}>⚠️ No team owner found</div>;
            }
            return (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "linear-gradient(90deg,#fbbf24,#fb923c)", backgroundBlendMode: "multiply", color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 999, background: "linear-gradient(135deg,#f59e0b,#fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 22 }}>
                    {(owner.user_profile?.full_name?.charAt(0) || owner.user_profile?.username?.charAt(0) || "👑").toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{owner.user_profile?.full_name || owner.user_profile?.username || `Owner ${owner.user_id?.substring(0, 8)}`}</div>
                    <div style={{ color: "#fff", opacity: 0.9 }}>📧 {owner.user_profile?.email || `ID: ${owner.user_id?.substring(0, 12)}`}</div>
                  </div>
                </div>
              </div>
            );
          })()}  */}

          {/* members table */}
          {/* {teamMembers.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...styles.table }}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableHeaderCell }}>👤 Member</th>
                    <th style={{ ...styles.tableHeaderCell }}>📧 Email</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>🎭 Role</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>📊 Feedback</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>✅ Success Rate</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>📈 Recent</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>📅 Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers
                    .slice()
                    .sort((a, b) => {
                      if (a.role === "owner" && b.role !== "owner") return -1;
                      if (b.role === "owner" && a.role !== "owner") return 1;
                      return new Date(a.joined_at) - new Date(b.joined_at);
                    })
                    .map((member, idx) => (
                      <tr key={member.user_id || idx} style={{ ...styles.tableRow }}>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 48, height: 48, borderRadius: 999, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
                              {(member.user_profile?.full_name?.charAt(0) || member.user_profile?.username?.charAt(0) || member.user_profile?.email?.charAt(0) || "?").toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{member.user_profile?.full_name || member.user_profile?.username || member.user_profile?.email?.split?.("@")?.[0] || `Member ${member.user_id?.substring(0, 8)}`}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: 12 }}>
                          <div style={{ background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: 8, display: "inline-block", color: "#fff", fontSize: 13 }}>
                            📧 {member.user_profile?.email || `ID: ${member.user_id?.substring(0, 12)}`}
                          </div>
                        </td>

                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, fontWeight: 700, color: member.role === "owner" ? "#92400e" : member.role === "lead" ? "#1e3a8a" : "#0f172a", background: member.role === "owner" ? "rgba(250,204,21,0.12)" : member.role === "lead" ? "rgba(59,130,246,0.06)" : "rgba(148,163,184,0.04)" }}>
                            {member.role === "owner" ? "👑 Owner" : member.role === "lead" ? "⭐ Lead" : "👤 Member"}
                          </div>
                        </td>

                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", display: "inline-block" }}>
                            <div style={{ fontWeight: 800 }}>{member.stats?.totalFeedback || 0}</div>
                          </div>
                        </td>

                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ padding: "6px 10px", borderRadius: 8, display: "inline-block", background: (member.stats?.acceptanceRate || 0) >= 70 ? "rgba(34,197,94,0.06)" : (member.stats?.acceptanceRate || 0) >= 50 ? "rgba(250,204,21,0.06)" : "rgba(248,113,113,0.06)", color: (member.stats?.acceptanceRate || 0) >= 70 ? "#bbf7d0" : (member.stats?.acceptanceRate || 0) >= 50 ? "#fde68a" : "#fecaca", fontWeight: 800 }}>
                            {member.stats?.acceptanceRate || 0}%
                          </div>
                        </td>

                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", display: "inline-block", color: "#fff" }}>
                            {member.stats?.recentActivity || 0}
                          </div>
                        </td>

                        <td style={{ padding: 12, textAlign: "center" }}>
                          <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", display: "inline-block", color: "#cbd5e1" }}>
                            {new Date(member.joined_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 12, textAlign: "center", color: "#cbd5e1" }}>No team members found</div>
          )}
        </div> */}

        {/* action buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 28 }}>
          <Link to="/teams" style={{ textDecoration: "none" }}>
            <div style={{ ...styles.btnGhost }}>← Back to Teams</div>
          </Link>

          <button onClick={() => window.location.reload()} style={{ ...styles.btnPrimary }}>
            <span style={{ transform: "translateY(0)" }}>🔄</span> Refresh Dashboard
          </button>

          {memberInfo && memberInfo.role !== "owner" && (
            <button onClick={handleLeaveTeam} style={{ ...styles.btnPrimary, background: "linear-gradient(90deg,#ef4444,#fb7185)" }}>
              🚪 Leave Team
            </button>
          )}
        </div>

        {/* leave modal */}
        {showLeaveConfirmation && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ width: "min(720px, 95%)", borderRadius: 16, padding: 20, background: "rgba(17,24,39,0.96)", color: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{ width: 64, height: 64, margin: "0 auto 12px", borderRadius: 999, background: "linear-gradient(135deg,#ef4444,#fb7185)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚠️</div>
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>Leave Team?</h3>
                <p style={{ color: "#cbd5e1", marginTop: 6 }}>Are you sure you want to leave "{teamInfo?.team_name || "this team"}"?</p>
                <p style={{ color: "#94a3b8", fontSize: 13 }}>You will lose access to all team resources and will need to be re-invited to rejoin.</p>
              </div>

              <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.02)", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 Your Team Contributions</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#94a3b8" }}>Total Feedback</div>
                    <div style={{ fontWeight: 800 }}>{myStats.totalFeedback}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#94a3b8" }}>Acceptance Rate</div>
                    <div style={{ fontWeight: 800 }}>{myStats.acceptanceRate}%</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={cancelLeaveTeam} disabled={isLeavingTeam} style={{ ...styles.btnGhost, flex: 1 }}>Cancel</button>
                <button onClick={confirmLeaveTeam} disabled={isLeavingTeam} style={{ ...styles.btnPrimary, flex: 1, background: "linear-gradient(90deg,#ef4444,#fb7185)" }}>
                  {isLeavingTeam ? "Leaving..." : "Leave Team"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

            {/* small spin keyframes via style tag to animate spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div> 
  );
};

export default MemberDashboard;
