// LeaderDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  ResponsiveContainer,
} from "recharts";

import { teamsAPI, feedbackAPI, ApiError } from "../utils/api"; // reused APIs

const COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#38bdf8"];

// --- utility classifier and tooltip (unchanged) ---
const classifyType = (type = "", suggestion = "") => {
  const text = `${type} ${suggestion}`.toLowerCase();
  if (text.includes("syntax") || text.includes("bracket") || text.includes("semicolon")) return "Syntax";
  if (text.includes("logic") || text.includes("condition") || text.includes("if")) return "Logical";
  if (text.includes("semantic") || text.includes("type error") || text.includes("undefined")) return "Semantic";
  if (text.includes("performance") || text.includes("optimize") || text.includes("speed")) return "Performance";
  if (text.includes("security") || text.includes("vulnerability") || text.includes("injection")) return "Security";
  return "Non-Critical";
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(17,25,40,0.9)",
          border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: "8px",
          padding: "8px 12px",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          fontSize: "0.85rem",
          fontWeight: 500,
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <p style={{ margin: 0 }}>{`${label} : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

/* ---------- Styles & small helpers copied from MemberDashboard (for identical look) ---------- */
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
  animatedBgCircle: (extra = {}) => ({
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(28px)",
    mixBlendMode: "screen",
    opacity: 0.18,
    ...extra,
  }),
};

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

/* ---------- FeedbackSubmissionForm (copied exactly, unchanged logic) ---------- */
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
        reviewer_id: currentUserId,
        reviewee_id: selectedMember,
        rating: parseInt(rating),
        category,
        comments: comments.trim(),
        suggestions: suggestions.trim(),
      };
      // uses backend helper
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

/* ---------- LeaderDashboard main component (original + peer feedback injection) ---------- */
const LeaderDashboard = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  // existing analytics states
  const [feedback, setFeedback] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState("all");
  const [loading, setLoading] = useState(true);
  const [teamInfo, setTeamInfo] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // new peer-feedback states (from MemberDashboard)
  const [teamMembersForFeedback, setTeamMembersForFeedback] = useState([]); // includes profiles + roles
  const [memberInfo, setMemberInfo] = useState(null); // current member info (joined_at, role, user_id)
  const [myTeamFeedback, setMyTeamFeedback] = useState([]); // feedbacks submitted by current user (team_feedback)
  const [receivedTeamFeedback, setReceivedTeamFeedback] = useState([]); // feedbacks received by current user (team_feedback)
  const [myStatsTeam, setMyStatsTeam] = useState({
    totalFeedback: 0,
    avgRating: 0,
    recentActivity: 0,
    acceptanceRate: 0,
  });

  // fetch analytics + team + team_feedback
  useEffect(() => {
    mountedRef.current = true;
    if (!teamId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // auth user
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }

        // team info (existing logic adapted)
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .select("*")
          .eq("team_id", teamId)
          .single();

        if (teamError || !team) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const isOwner = team.owner_id === user.id || team.team_lead_id === user.id;
        if (!isOwner) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setTeamInfo(team);

        // existing: get team_members then user_profiles for analytics
        const { data: teamMembers } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("team_id", teamId);

        const memberIds = (teamMembers || []).map((m) => m.user_id);

        const { data: userData } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("id", memberIds);

        setMembers(userData || []);

        // get code-review feedback (your existing analytics)
        let query = supabase
          .from("feedback")
          .select("*")
          .eq("team_id", teamId)
          .order("created_at", { ascending: false });

        if (selectedMember !== "all") query = query.eq("user_id", selectedMember);

        const { data: feedbackData } = await query;

        const enriched = (feedbackData || []).map(f => ({
          ...f,
          classified_type: classifyType(f.suggestion_type, f.suggestion),
        }));

        setFeedback(enriched);

        // -----------------------
        // new: load team feedback / team members + profiles (exact logic from MemberDashboard)
        // -----------------------
        // Step A: get team_members rows with role + joined_at
        const { data: memberRows, error: memberRowsErr } = await supabase
          .from("team_members")
          .select("user_id, role, joined_at")
          .eq("team_id", teamId);

        if (memberRowsErr) throw memberRowsErr;

        // Step B: fetch profiles for those users
        const userIds = (memberRows || []).map((m) => m.user_id);
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, username, email")
          .in("id", userIds);

        if (profileErr) throw profileErr;

        // Step C: fetch all team_feedback rows for this team
        const { data: teamFeedbackRows, error: teamFeedbackErr } = await supabase
          .from("team_feedback")
          .select("id, team_id, reviewer_id, reviewee_id, rating, category, comments, suggestions, created_at")
          .eq("team_id", teamId)
          .order("created_at", { ascending: false });

        if (teamFeedbackErr) throw teamFeedbackErr;

        // compute stats per member (as in MemberDashboard)
        const statsMap = {};
        userIds.forEach((id) => {
          const given = (teamFeedbackRows || []).filter((f) => f.reviewer_id === id);
          const received = (teamFeedbackRows || []).filter((f) => f.reviewee_id === id);
          const totalFeedback = given.length;
          const avgRating = received.length > 0 ? received.reduce((sum, f) => sum + (f.rating || 0), 0) / received.length : 0;
          const joinedDate = new Date(memberRows.find((m) => m.user_id === id)?.joined_at);
          const activitySinceJoined = given.filter((f) => new Date(f.created_at) >= joinedDate).length;
          statsMap[id] = {
            totalFeedback,
            acceptanceRate: Math.round(avgRating * 20),
            recentActivity: activitySinceJoined,
          };
        });

        const formattedMembers = (memberRows || []).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          user_profile: profileRows?.find((p) => p.id === m.user_id) || {},
          stats: statsMap[m.user_id] || { totalFeedback: 0, acceptanceRate: 0, recentActivity: 0 },
        }));

        setTeamMembersForFeedback(formattedMembers);

        // fill memberInfo (the current user's entry if present)
        const myMemberRow = memberRows.find((r) => r.user_id === user.id);
        setMemberInfo(myMemberRow ? { user_id: myMemberRow.user_id, role: myMemberRow.role, joined_at: myMemberRow.joined_at } : { user_id: user.id });

        // my feedback (submitted by current user)
        const myGiven = (teamFeedbackRows || []).filter((f) => f.reviewer_id === user.id);
        setMyTeamFeedback(myGiven);

        // feedback received by current user
        const myReceived = (teamFeedbackRows || []).filter((f) => f.reviewee_id === user.id);
        setReceivedTeamFeedback(myReceived);

        // set myStatsTeam
        setMyStatsTeam({
          totalFeedback: myGiven.length,
          avgRating: myReceived.length > 0 ? (myReceived.reduce((s, r) => s + (r.rating || 0), 0) / myReceived.length).toFixed(1) : 0,
          recentActivity: statsMap[user.id]?.recentActivity || 0,
          acceptanceRate: statsMap[user.id]?.acceptanceRate || 0,
        });

      } catch (err) {
        console.error("Error fetching data:", err);
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, selectedMember, navigate]);

  // helper for CSV (unchanged)
  const getEmail = (f) => f.email || "Unknown";

  const statsObj = {
    total: feedback.length,
    accepted: feedback.filter(f => f.decision === "accepted").length,
    rejected: feedback.filter(f => f.decision === "rejected").length,
    members: members.length,
  };

  const pieData = [
    { name: "Accepted", value: feedback.filter(f => f.decision === "accepted").length },
    { name: "Rejected", value: feedback.filter(f => f.decision === "rejected").length },
  ];

  const typeData = feedback.reduce((acc, f) => {
    const type = f.classified_type || "Non-Critical";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const barData = Object.entries(typeData).map(([type, count]) => ({ type, count }));

  // CSV download (unchanged)
  const handleDownloadCSV = () => {
    const headers = ["Member", "Type", "Decision", "Suggestion", "Comment"];
    const rows = feedback.map(f => [
      getEmail(f),
      f.classified_type || "General",
      f.decision || "Pending",
      `"${f.suggestion || "-"}"`,
      `"${f.comment || "-"}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${teamInfo?.team_name || "team"}_feedback.csv`;
    link.click();
  };

  // Loading UI (unchanged structure)
  if (loading)
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#fff",
        fontFamily: "Poppins, sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Loading Team Dashboard...</div>
          <div style={{ color: "#94a3b8" }}>Fetching analytics...</div>
          <div style={{
            margin: "20px auto", width: 40, height: 40, borderRadius: "50%",
            borderTop: "3px solid #8b5cf6", animation: "spin 1s linear infinite"
          }} />
          <style>{`@keyframes spin {to{transform:rotate(360deg);}}`}</style>
        </div>
      </div>
    );

  // Access Denied (unchanged)
  if (accessDenied)
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center text-center text-white">
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-8 max-w-md mx-4 border border-white border-opacity-20">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="opacity-90 mb-6">Only the team owner can access this dashboard.</p>
          <Link to="/teams" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105">
            Back to Teams
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",
      color: "#fff",
      padding: "40px 20px",
      fontFamily: "Poppins, sans-serif"
    }}>
      {/* animated bg from member styles (keeps visual harmony) */}
      <div style={styles.animatedBgCircle({ top: "-120px", right: "-120px", width: 320, height: 320, background: "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.85), rgba(59,130,246,0.6))" })} />
      <div style={styles.animatedBgCircle({ bottom: "-120px", left: "-120px", width: 300, height: 300, background: "radial-gradient(circle at 60% 60%, rgba(16,185,129,0.85), rgba(34,197,94,0.4))" })} />
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>

        {/* Header (unchanged) */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            fontSize: "2.8rem", fontWeight: 800,
            background: "linear-gradient(to right,#8b5cf6,#f472b6,#60a5fa)",
            WebkitBackgroundClip: "text", color: "transparent", marginBottom: 10
          }}>
            📋 Team Dashboard
          </h1>
          <p style={{ color: "#cbd5e1", fontWeight: 500 }}>
            {teamInfo ? `Analytics for "${teamInfo.team_name}"` : "Team Analytics"}
          </p>
        </div>

        {/* Summary Cards (unchanged) */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
          gap: 20, marginBottom: 40
        }}>
          {[
            { icon: "📊", title: "Total Feedback", value: statsObj.total },
            { icon: "✅", title: "Accepted", value: statsObj.accepted },
            { icon: "❌", title: "Rejected", value: statsObj.rejected },
            { icon: "👥", title: "Team Members", value: statsObj.members },
          ].map((c, i) => (
            <div key={i} style={{
              background: "rgba(17,25,40,0.85)", borderRadius: 20,
              border: "1px solid rgba(148,163,184,0.15)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
              padding: 24, textAlign: "center",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-6px) scale(1.03)";
                e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.6)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.4)";
              }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{c.title}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#a78bfa" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Member Filter (unchanged) */}
        <div style={{
          background: "rgba(17,25,40,0.85)",
          borderRadius: 20, padding: 20,
          marginBottom: 40, border: "1px solid rgba(148,163,184,0.15)",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 20,
          }}>
            <div>
              <h3 style={{ fontWeight: 700 }}>Filter by Member</h3>
              <p style={{ color: "#94a3b8" }}>View analytics for individual members</p>
            </div>
            <select
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              style={{
                background: "rgba(255, 255, 255, 0.1)", borderRadius: 10,
                color: "#0b0909ff", border: "1px solid rgba(212, 202, 202, 1)",
                padding: "10px 14px", cursor: "pointer",
              }}
            >
              <option value="all" >All Members</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Charts (unchanged) */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
          gap: 24, marginBottom: 40,
        }}>
          <div style={{
            background: "rgba(17,25,40,0.85)",
            borderRadius: 20, border: "1px solid rgba(148,163,184,0.15)",
            padding: 24,
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: 10 }}>🥧 Feedback Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: "rgba(17,25,40,0.85)",
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.15)",
            padding: 24,
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: 10 }}>📊 Suggestion Types</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <XAxis dataKey="type" stroke="#94a3b8" />
                <YAxis allowDecimals={false} stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feedback Table (unchanged) */}
        <div style={{
          background: "rgba(17,25,40,0.85)",
          borderRadius: 20,
          border: "1px solid rgba(148,163,184,0.15)",
          padding: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>📋 Feedback Records</h3>
            <button
              onClick={handleDownloadCSV}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)",
                color: "#fff", fontWeight: 700, cursor: "pointer",
              }}
            >
              ⬇️ Download CSV
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                  {["Member", "Type", "Decision", "Suggestion", "Comment"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "12px", color: "#94a3b8" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedback.length > 0 ? (
                  feedback.map((f, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 12px" }}>{getEmail(f)}</td>
                      <td style={{ padding: "10px 12px" }}>{f.classified_type}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {f.decision === "accepted"
                          ? "✅ Accepted"
                          : f.decision === "rejected"
                          ? "❌ Rejected"
                          : "⏳ Pending"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{f.suggestion || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>{f.comment || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                      No feedback records available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ------------------- Inserted: Give Feedback section (exact copy + behavior) ------------------- */}
        <div style={{ marginTop: 28, marginBottom: 28, ...styles.glassCard }}>
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
            teamMembers={teamMembersForFeedback}
            currentUserId={memberInfo?.user_id}
            teamId={teamId}
            onFeedbackSubmitted={async () => {
              // refresh team_feedback lists only (keeps other charts unaffected)
              try {
                const { data: teamFeedbackRows } = await supabase
                  .from("team_feedback")
                  .select("id, team_id, reviewer_id, reviewee_id, rating, category, comments, suggestions, created_at")
                  .eq("team_id", teamId)
                  .order("created_at", { ascending: false });

                setMyTeamFeedback((teamFeedbackRows || []).filter((f) => f.reviewer_id === memberInfo?.user_id));
                setReceivedTeamFeedback((teamFeedbackRows || []).filter((f) => f.reviewee_id === memberInfo?.user_id));

                // recompute my stats
                const myGiven = (teamFeedbackRows || []).filter((f) => f.reviewer_id === memberInfo?.user_id);
                const myReceived = (teamFeedbackRows || []).filter((f) => f.reviewee_id === memberInfo?.user_id);
                setMyStatsTeam({
                  totalFeedback: myGiven.length,
                  avgRating: myReceived.length > 0 ? (myReceived.reduce((s, r) => s + (r.rating || 0), 0) / myReceived.length).toFixed(1) : 0,
                  recentActivity: myGiven.length,
                  acceptanceRate: Math.round((myReceived.length > 0 ? (myReceived.reduce((s, r) => s + (r.rating || 0), 0) / myReceived.length) : 0) * 20),
                });
              } catch (e) {
                console.error("Error refreshing team feedback after submit:", e);
              }
            }}
          />
        </div>

        {/* ------------------- Inserted: Feedback Received section (exact copy + behavior) ------------------- */}
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
              ⭐ {receivedTeamFeedback.length} Reviews
            </div>
          </div>

          {receivedTeamFeedback.length > 0 ? (
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
                  {receivedTeamFeedback.map((f, idx) => (
                    <tr key={f.id || idx} style={{ ...styles.tableRow }}>
                      <td style={{ padding: 14 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 999, background: "linear-gradient(135deg,#8b5cf6,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
                            {((teamMembersForFeedback.find(m => m.user_id === f.reviewer_id)?.user_profile?.full_name?.charAt(0)) ||
                              (teamMembersForFeedback.find(m => m.user_id === f.reviewer_id)?.user_profile?.email?.charAt(0)) ||
                              "?").toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{teamMembersForFeedback.find(m => m.user_id === f.reviewer_id)?.user_profile?.full_name || teamMembersForFeedback.find(m => m.user_id === f.reviewer_id)?.user_profile?.username || "Team Member"}</div>
                            <div style={{ color: "#94a3b8", fontSize: 13 }}>{teamMembersForFeedback.find(m => m.user_id === f.reviewer_id)?.user_profile?.email || "Unknown"}</div>
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
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedTeamFeedback.length > 0 ? (receivedTeamFeedback.reduce((s, r) => s + (r.rating || 0), 0) / receivedTeamFeedback.length).toFixed(1) : "N/A"}</div>
                  <div style={{ color: "#bbf7d0" }}>Average Rating</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedTeamFeedback.length}</div>
                  <div style={{ color: "#bfdbfe" }}>Total Reviews</div>
                </div>

                <div style={{ borderRadius: 10, padding: 12, background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{receivedTeamFeedback.filter((f) => f.rating >= 4).length}</div>
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

        {/* Navigation Buttons (unchanged) */}
        <div style={{
          textAlign: "center", marginTop: 40,
          display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap",
        }}>
          <Link to="/create-team" style={buttonStyle("#6366f1", "#8b5cf6")}>🆕 Create Team</Link>
          <Link to="/editor" style={buttonStyle("#34d399", "#059669")}>📝 Code Review</Link>
          <Link to="/" style={buttonStyle("#f472b6", "#ec4899")}>🏠 Home</Link>
        </div>
      </div>

      {/* spin keyframes for inline spinners */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const buttonStyle = (c1, c2) => ({
  padding: "10px 18px",
  borderRadius: 10,
  background: `linear-gradient(90deg,${c1},${c2})`,
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  transition: "0.3s",
});

export default LeaderDashboard;
