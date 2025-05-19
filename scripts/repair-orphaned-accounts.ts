// Utility script to repair orphaned accounts by creating missing profiles
// This can be run as needed to fix any accounts that somehow ended up without profiles

import { createClient } from '@supabase/supabase-js';

// Update these with your project's details
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key (for admin operations)
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function repairOrphanedAccounts() {
  console.log('[Repair] Starting orphaned account repair process');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('[Repair] Error listing users:', error.message);
      return;
    }
    
    console.log(`[Repair] Found ${users.users.length} users to check`);
    for (const user of users.users) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code === 'PGRST116') {
        console.log(`[Repair] Creating missing profile for ${user.id}`);
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          username: `Player_${user.id.substring(0, 6)}`,
          eth_address: user.user_metadata?.eth_address,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
        
        if (insertError) {
          console.error(`[Repair] Error creating profile for ${user.id}:`, insertError.message);
        } else {
          console.log(`[Repair] Created missing profile for ${user.id}`);
        }
      } else if (!profileError) {
        console.log(`[Repair] Profile already exists for ${user.id}`);
      } else {
        console.error(`[Repair] Error checking profile for ${user.id}:`, profileError.message);
      }
    }
    console.log('[Repair] Orphaned account repair process completed');
  } catch (e) {
    console.error('[Repair] Exception in repairOrphanedAccounts:', e instanceof Error ? e.message : String(e));
  }
}

// Execute the repair function
repairOrphanedAccounts().catch(console.error);
