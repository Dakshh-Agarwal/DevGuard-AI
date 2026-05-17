// Fix profile data script
require('dotenv').config({ path: './.env' });
const { supabase } = require('../utils/supabaseClient');

async function fixProfileData() {
  console.log('🔧 Creating and updating user profiles...');

  try {

    // 2. Get all team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('user_id')
      .distinct();

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return;
    }

    console.log(`Found ${members.length} unique team members`);

    // 3. For each member, ensure they have a profile
    for (const member of members) {
      try {
        // Try to get user data from auth
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(member.user_id);
        
        if (userData?.user && !userError) {
          const user = userData.user;
          const email = user.email;
          const emailPrefix = email ? email.split('@')[0] : member.user_id.substring(0, 8);
          
          // Upsert profile data
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: member.user_id,
              email: email || `user-${member.user_id.substring(0, 8)}@example.com`,
              username: user.user_metadata?.username || emailPrefix,
              full_name: user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (profileError) {
            console.error(`Error upserting profile for ${member.user_id}:`, profileError);
          } else {
            console.log(`✅ Updated profile for ${member.user_id}`);
          }
        } else {
          // Create fallback profile
          const shortId = member.user_id.substring(0, 8);
          const { error: fallbackError } = await supabase
            .from('profiles')
            .upsert({
              id: member.user_id,
              email: `user-${shortId}@team.local`,
              username: `member_${shortId}`,
              full_name: `Member ${shortId.toUpperCase()}`,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });

          if (fallbackError) {
            console.error(`Error creating fallback profile for ${member.user_id}:`, fallbackError);
          } else {
            console.log(`⚠️ Created fallback profile for ${member.user_id}`);
          }
        }
      } catch (error) {
        console.error(`Error processing member ${member.user_id}:`, error);
      }
    }

    console.log('\n🎉 Profile data fix completed!');

  } catch (error) {
    console.error('❌ Error fixing profile data:', error);
  }
}

// Create RPC function for creating profiles table
async function createProfilesTableFunction() {
  const { error } = await supabase.rpc('create_function_create_profiles_table', {
    function_definition: `
      CREATE OR REPLACE FUNCTION create_profiles_table_if_not_exists()
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        -- Create profiles table if it doesn't exist
        CREATE TABLE IF NOT EXISTS profiles (
          id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email text,
          username text,
          full_name text,
          updated_at timestamp with time zone
        );

        -- Create index on email
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
      END;
      $$;
    `
  });

  if (error) {
    console.error('Error creating function:', error);
  } else {
    console.log('✅ Created profiles table function');
  }
}

async function runFixes() {
  await createProfilesTableFunction();
  await fixProfileData();
}

// Run the fix
if (require.main === module) {
  runFixes();
}

module.exports = { runFixes };