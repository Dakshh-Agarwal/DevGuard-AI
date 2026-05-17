// server/utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Get credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase credentials:");
  console.error("SUPABASE_URL:", supabaseUrl ? "✓ Set" : "❌ Missing");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceRoleKey ? "✓ Set" : "❌ Missing");
  throw new Error("Missing Supabase URL or service role key in environment variables.");
}

console.log("✅ Supabase client initialized with service role key");

// Create admin client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase };
