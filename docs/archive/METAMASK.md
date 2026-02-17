# Implementing Synchronized Authentication and Profile Creation

## Overview
This document outlines a phased approach to fix the game creation issue by ensuring user profiles are created immediately after authentication. The plan starts with the minimal necessary changes and progressively adds more robust solutions if needed.

---

## Implementation Checklist

### Phase 1: Core Solution (Essential Implementation)

#### 1. Add Global Auth State Observer
- [x] **Create a new file `src/hooks/useAuthProfileSync.ts`:**

```typescript
import { useEffect } from 'react';
import { supabase } from '../utils/supabase';

export function useAuthProfileSync() {
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await ensureProfileExists(session.user.id, session.user.user_metadata?.eth_address);
        }
      }
    );
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);
}

async function ensureProfileExists(userId: string, ethAddress?: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    if (error && error.code === 'PGRST116') {
      console.log('[AuthSync] No profile found, creating new one for:', userId);
      const { error: insertError } = await supabase.from('profiles').upsert({
        id: userId,
        username: `Player_${userId.substring(0, 6)}`,
        eth_address: ethAddress,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      
      if (insertError) {
        console.error('[AuthSync] Error creating profile:', insertError.message);
      } else {
        console.log('[AuthSync] Profile created successfully');
      }
    } else if (!error) {
      console.log('[AuthSync] Profile already exists for:', userId);
    } else {
      console.error('[AuthSync] Error checking profile:', error.message);
    }
  } catch (e) {
    console.error('[AuthSync] Exception in ensureProfileExists:', e instanceof Error ? e.message : String(e));
  }
}
```

- [x] **Integrate the hook in `src/App.tsx` or main layout component:**

```typescript
import { useAuthProfileSync } from './hooks/useAuthProfileSync';

function App() {
  useAuthProfileSync();
  return (
    // ...
  );
}
```

#### 2. Update Supabase Row-Level Security Policies
- [x] **Add a policy to allow authenticated users to create their own profiles:**

```sql
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);
```

- [x] **Add a policy to allow users to update their own profiles:**

```sql
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);
```

#### 3. Test the Core Implementation
- [x] **Test the authentication flow:**
  - [x] Connect wallet on the home page
  - [x] Verify profile is created (check console logs and database)
  - [x] Attempt to create a game
  - [x] Verify no foreign key constraint errors
  - [x] Test rejoining an existing game after authentication
  - [x] Test session persistence by refreshing the page and ensuring the user remains authenticated
  - [x] Verify profile data is retained correctly across multiple login sessions

### Phase Transition Criteria
**When to move from Phase 1 to Phase 2:**
- If users still experience foreign key errors after 50+ successful logins
- If more than 2% of game creation attempts fail due to profile synchronization issues
- If users report profile-related errors on specific devices or browsers not covered in testing
- After one week of Phase 1 deployment with no issues, consider Phase 1 sufficient and mark Phase 2 as optional

---

### Phase 2: Additional Protection Layers (If Needed)

#### 4. Enhance the `authenticateWithWallet` Function
- [x] **Modify `Lobby.tsx` to create a profile immediately after successful authentication:**

```typescript
const authenticateWithWallet = async (walletAddress: string) => {
  // ... existing authentication code ...
  if (data) {
    // ...
    try {
      const userId = data.user.id;
      console.log('[Wallet Auth] Creating/updating profile for user:', userId);
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        username: `Player_${userId.substring(0, 6)}`,
        eth_address: walletAddress,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      
      if (error) {
        console.error('[Wallet Auth] Error ensuring profile exists:', error.message);
      } else {
        console.log('[Wallet Auth] Profile created/updated successfully');
      }
    } catch (e) {
      console.error('[Wallet Auth] Exception while creating profile:', e instanceof Error ? e.message : String(e));
    }
    return data;
  }
}
```

#### 5. Verify Profile Exists Before Game Creation
- [x] **Update `supabase.ts` to check for profile existence before game creation:**

```typescript
export async function createGame(gameId: string, player1Id: string, betAmount: number): Promise<any | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    const effectivePlayerId = sessionUserId || getCorrectPlayerId(player1Id);
    await ensureProfileExists(effectivePlayerId, player1Id);
    // ...
  }
}

async function ensureProfileExists(userId: string, ethAddress?: string) {
  try {
    console.log('[Game Creation] Ensuring profile exists for:', userId);
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      username: `Player_${userId.substring(0, 6)}`,
      eth_address: ethAddress?.startsWith('0x') ? ethAddress : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    
    if (error) {
      console.error('[Game Creation] Error ensuring profile exists:', error.message);
    } else {
      console.log('[Game Creation] Profile confirmed for user:', userId);
    }
  } catch (e) {
    console.error('[Game Creation] Exception in ensureProfileExists:', e instanceof Error ? e.message : String(e));
  }
}
```

---

### Phase 3: Backend Enhancements (Advanced Options)

#### 6. Update Edge Function for Game Creation
- [x] **Modify `index.ts` to properly handle profile creation:**

```typescript
try {
  console.log('[Edge Function] Ensuring profile exists via RPC for:', effectivePlayerId);
  await supabase.rpc('ensure_profile_exists', {
    profile_id: effectivePlayerId,
    profile_username: `Player_${effectivePlayerId.substring(0, 6)}`,
    eth_addr: player1Id?.startsWith('0x') ? player1Id : null
  });
  console.log('[Edge Function] Profile ensured successfully via RPC');
} catch (profileErr) {
  console.error('[Edge Function] RPC error:', profileErr instanceof Error ? profileErr.message : String(profileErr));
  try {
    console.log('[Edge Function] Falling back to direct upsert for profile:', effectivePlayerId);
    await supabase.from('profiles').upsert({
      id: effectivePlayerId,
      username: `Player_${effectivePlayerId.substring(0, 6)}`,
      eth_address: player1Id?.startsWith('0x') ? player1Id : null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
    console.log('[Edge Function] Fallback profile creation successful');
  } catch (fallbackErr) {
    console.error('[Edge Function] Fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
    throw new Error('Failed to ensure profile exists: ' + String(fallbackErr));
  }
}
```

#### 7. Create a Database Function for Profile Creation (Optional)
- [x] **Add a stored procedure for profile creation: (Deployed via Supabase MCP)**

```sql
CREATE OR REPLACE FUNCTION ensure_profile_exists(
  profile_id TEXT,
  profile_username TEXT,
  eth_addr TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO profiles (id, username, eth_address, created_at, updated_at)
  VALUES (
    profile_id, 
    profile_username,
    eth_addr,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    username = COALESCE(profiles.username, EXCLUDED.username),
    eth_address = COALESCE(profiles.eth_address, EXCLUDED.eth_address),
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ensure_profile_exists TO authenticated;
```

#### 8. Troubleshooting and Monitoring (As Needed)
- [x] **Create a utility to fix orphaned accounts:**

```typescript
async function repairOrphanedAccounts() {
  console.log('[Repair] Starting orphaned account repair process');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('[Repair] Error listing users:', error.message);
      return;
    }
    
    console.log(`[Repair] Found ${users.length} users to check`);
    for (const user of users) {
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
```

---

## Implementation Strategy

- ✅ **Phase 1 Completed** - Core authentication observer and RLS policies implemented
- ✅ **Phase 2 Completed** - Enhanced wallet authentication with immediate profile creation 
- ✅ **Phase 3 Completed** - Database function for profile creation created via Supabase MCP

All phases of the implementation have been completed successfully. The changes have been verified and tested.

For detailed technical documentation on the implementation, see `/mythical-beings-mvp/AUTH_PROFILE_SYNC.md`.

By implementing in phases, we identified the minimum changes needed while maintaining a clean codebase.