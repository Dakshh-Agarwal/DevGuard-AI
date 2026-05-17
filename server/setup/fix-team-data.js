// Fix team data script
require('dotenv').config({ path: './.env' });
const { supabase } = require('../utils/supabaseClient');

async function fixTeamRoles() {
  console.log('🔧 Fixing team ownership roles...');

  try {
    // 1. Get all teams with their actual owners
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('team_id, team_name, team_lead_id, owner_id, created_at');

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return;
    }

    console.log('Found teams:', teams);

    for (const team of teams) {
      console.log(`\n--- Processing Team: ${team.team_name} (${team.team_id}) ---`);
      
      // The actual owner should be team_lead_id or owner_id
      const actualOwnerId = team.owner_id || team.team_lead_id;
      
      if (!actualOwnerId) {
        console.log('⚠️  No owner found for team:', team.team_name);
        continue;
      }

      console.log('Actual owner should be:', actualOwnerId);

      // Get all members of this team
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', team.team_id);

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        continue;
      }

      console.log('Current team members:', teamMembers);

      // Fix roles: set correct owner and make others members
      for (const member of teamMembers) {
        const correctRole = member.user_id === actualOwnerId ? 'owner' : 'member';
        
        if (member.role !== correctRole) {
          console.log(`Updating ${member.user_id} from ${member.role} to ${correctRole}`);
          
          const { error: updateError } = await supabase
            .from('team_members')
            .update({ role: correctRole })
            .eq('team_id', team.team_id)
            .eq('user_id', member.user_id);

          if (updateError) {
            console.error(`Error updating member role:`, updateError);
          } else {
            console.log(`✅ Updated ${member.user_id} role to ${correctRole}`);
          }
        } else {
          console.log(`${member.user_id} already has correct role: ${correctRole}`);
        }
      }

      // Verify the fix for this team
      const { data: verifyMembers, error: verifyError } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', team.team_id);

      if (!verifyError) {
        const owners = verifyMembers.filter(m => m.role === 'owner');
        const members = verifyMembers.filter(m => m.role === 'member');
        console.log(`✅ Team ${team.team_name}: ${owners.length} owner(s), ${members.length} member(s)`);
        
        if (owners.length !== 1) {
          console.log('⚠️  Warning: Team should have exactly 1 owner, found:', owners.length);
        }
      }
    }

    console.log('\n🎉 Team role fix completed!');

  } catch (error) {
    console.error('❌ Error fixing team data:', error);
  }
}

async function getUserEmails() {
  console.log('\n📧 Fetching user emails from Supabase auth...');
  
  try {
    // Get a few user IDs from team members to test
    const { data: sampleMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .limit(5);

    if (sampleMembers) {
      for (const member of sampleMembers) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(member.user_id);
          
          if (userData?.user && !userError) {
            console.log(`User ${member.user_id}: ${userData.user.email}`);
          } else {
            console.log(`Could not fetch user ${member.user_id}:`, userError?.message);
          }
        } catch (authError) {
          console.log(`Auth error for ${member.user_id}:`, authError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching user emails:', error);
  }
}

async function fixTeamData() {
  console.log('🔧 Fixing team data relationships and roles...');
  await fixTeamRoles();
  await getUserEmails();
}

// Run the fix
if (require.main === module) {
  fixTeamData();
}

module.exports = { fixTeamData };