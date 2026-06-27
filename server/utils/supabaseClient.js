// server/utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Get credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.error("Missing Supabase credentials", {
    supabase_url: supabaseUrl ? 'set' : 'MISSING',
    service_role_key: supabaseServiceRoleKey ? 'set' : 'MISSING',
    context: 'supabase.init',
  });
  throw new Error("Missing Supabase URL or service role key in environment variables.");
}

logger.info("Supabase client initialized with service role key", {
  context: 'supabase.init',
});

// Create admin client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase };
