// API utility for backend communication
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}`;
import { supabase } from '../supabaseClient';

/* =====================================================
   ⚠️ Custom Error Class
   ===================================================== */
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/* =====================================================
   ⚙️ Utility: Get Supabase Auth Token
   ===================================================== */
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

/* =====================================================
   🌐 Generic Backend API Call Helper
   ===================================================== */
const apiCall = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await getAuthToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error.message}`, 0, error);
  }
};

/* =====================================================
   🧩 TEAMS API
   ===================================================== */
export const teamsAPI = {
  // 🔹 Fetch all team members (with profile info for dropdown)
  getMembers: async (teamId) => {
    const { data, error } = await supabase
      .from("team_members")
      .select(`
        user_id,
        role,
        joined_at,
        user_profile:profiles (id, full_name, username, email)
      `)
      .eq("team_id", teamId)
      .order("joined_at", { ascending: true });

    if (error) throw error;
    return { members: data || [] };
  },

  // Get team info and member info for current user
  getTeamInfo: async (teamId) => {
    return await apiCall(`/api/teams/${teamId}/info`);
  },

  // Get feedback given by current member (code review feedback from entire team)
  getMyFeedback: async (teamId) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("User not authenticated");

    // Fetch ALL team feedback (code reviews) for this team, not just current user's
    const { data: feedbackData, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team feedback:", error);
      throw error;
    }

    if (!feedbackData || feedbackData.length === 0) {
      return {
        feedback: [],
        stats: {
          totalFeedback: 0,
          avgRating: 0,
          recentActivity: 0,
          acceptanceRate: 0,
        },
      };
    }

    // Get unique user IDs from the feedback
    const userIds = [...new Set(feedbackData.map(f => f.user_id).filter(Boolean))];

    // Fetch profiles for these users
    const { data: profilesData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, email")
      .in("id", userIds);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
    }

    // Map profiles to feedback
    const feedbackWithProfiles = feedbackData.map(feedback => ({
      ...feedback,
      user_profile: profilesData?.find(p => p.id === feedback.user_id) || null
    }));

    // Calculate stats for current user's submissions
    const myFeedback = feedbackWithProfiles.filter(f => f.user_id === userId);
    const totalFeedback = myFeedback.length;
    const acceptedFeedback = myFeedback.filter(f => f.decision === 'accepted').length;
    const acceptanceRate = totalFeedback > 0 ? Math.round((acceptedFeedback / totalFeedback) * 100) : 0;

    return {
      feedback: feedbackWithProfiles, // Return ALL team feedback
      stats: {
        totalFeedback,
        avgRating: 0, // Not applicable for code reviews
        recentActivity: myFeedback.filter(
          (f) =>
            new Date(f.created_at) >=
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        acceptanceRate,
      },
    };
  },

  // Backend endpoints (keep for compatibility)
  createTeam: async (teamName) =>
    apiCall('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ team_name: teamName }),
    }),

  joinTeam: async (teamId) => apiCall(`/api/teams/${teamId}/join`),
  updateMemberRole: async (teamId, userId, role) =>
    apiCall(`/api/teams/${teamId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: async (teamId, userId) =>
    apiCall(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  leaveTeam: async (teamId) =>
    apiCall(`/api/teams/${teamId}/leave`, { method: 'POST' }),

  getAnalytics: async (teamId) => apiCall(`/api/teams/${teamId}/analytics`),
  getLeaderDashboard: async (teamId) => apiCall(`/api/teams/${teamId}/dashboard`),
  fixRoles: async () => apiCall('/api/teams/fix-roles', { method: 'POST' }),
};

/* =====================================================
   🧩 FEEDBACK API
   ===================================================== */
export const feedbackAPI = {
  // 🔹 Submit peer feedback (directly to Supabase)
  submitPeerFeedback: async (feedbackData) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("User not authenticated");

    const payload = { ...feedbackData, reviewer_id: userId };
    const { error } = await supabase.from("team_feedback").insert([payload]);
    if (error) throw error;
    return true;
  },

  // 🔹 Fetch feedback received by logged-in user (Supabase join)
  getReceivedFeedback: async (teamId) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("team_feedback")
      .select(`
        *,
        reviewer_profile:reviewer_id (id, full_name, username, email)
      `)
      .eq("team_id", teamId)
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Existing backend feedback endpoints (for other feedback systems)
  submitCodeFeedback: async (feedbackData) =>
    apiCall('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    }),

  getMyTeamFeedback: async (teamId) =>
    apiCall(`/api/feedback/my/${teamId}`),

  getAllFeedback: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const queryString = params.toString();
    return apiCall(`/api/feedback/all${queryString ? `?${queryString}` : ''}`);
  },
};

/* =====================================================
   📊 STATS & ANALYSIS API (Backend)
   ===================================================== */
export const statsAPI = {
  getDashboardStats: async () => apiCall('/api/stats'),
};

export const analysisAPI = {
  analyzeCode: async (codeData) =>
    apiCall('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(codeData),
    }),

  analyzeMultipleFiles: async (formData) =>
    apiCall('/api/analyze/multi', {
      method: 'POST',
      body: formData,
      headers: {}, // remove Content-Type for FormData
    }),
};

/* =====================================================
   🔚 EXPORTS
   ===================================================== */
export { ApiError };

export default {
  teamsAPI,
  feedbackAPI,
  statsAPI,
  analysisAPI,
  ApiError,
};
