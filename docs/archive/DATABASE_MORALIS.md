# Supabase Database Schema for Mythical Beings MVP (Moralis Web3 Auth Integration)

This document outlines the Supabase database schema and setup for the Mythical Beings MVP, designed for integration with Moralis for Web3 authentication (EVM chains). The user's EVM address will be the primary identifier in the `profiles` table and related foreign keys.

**Official Moralis Documentation Reference:**
It's highly recommended to follow Moralis's official guide for Supabase integration:
[Moralis Supabase Integration (Node.js)](https://docs.moralis.io/authentication-api/evm/integrations/supabase-nodejs)

This guide assumes you will have a backend (e.g., Node.js/Express server, or potentially a Supabase Edge Function) to handle the Moralis authentication flow and then issue a custom Supabase JWT.

---

## Table of Contents

1.  [Prerequisites](#prerequisites)
2.  [Phase 1: Database Cleanup (From Previous Auth)](#phase-1-database-cleanup)
3.  [Phase 2: Table Structure Review](#phase-2-table-structure-review)
    *   [2.1. `profiles` Table](#21-profiles-table) - `id` will be EVM Address
    *   [2.2. `game_status_enum` Type](#22-game_status_enum-type)
    *   [2.3. `games` Table](#23-games-table)
    *   [2.4. `moves` Table](#24-moves-table)
4.  [Phase 3: Core Functions](#phase-3-core-functions)
    *   [3.1. `update_updated_at_column()` Function](#31-update_updated_at_column-function)
    *   [3.2. `handle_new_moralis_user()` Function](#32-handle_new_moralis_user-function)
5.  [Phase 4: Row Level Security (RLS) Policies (Moralis Based)](#phase-4-row-level-security-rls-policies-moralis-based)
6.  [Phase 5: Storage (Avatars - EVM Address Based)](#phase-5-storage-avatars-evm-address-based)
7.  [Phase 6: Backend Authentication Flow (Moralis + Supabase JWT)](#phase-6-backend-authentication-flow-moralis--supabase-jwt)
8.  [Phase 7: Frontend Integration (Moralis SDK)](#phase-7-frontend-integration-moralis-sdk)
9.  [Phase 8: Testing Checklist (Moralis)](#phase-8-testing-checklist-moralis)

---

## Prerequisites

*   A Supabase project created.
*   A Moralis account and an API Key.
*   Node.js environment for your backend authentication handler (or familiarity with Supabase Edge Functions if you choose that route).
*   Familiarity with EVM concepts (addresses, signing messages).
*   Supabase Project URL and `anon` key for your backend.
*   Supabase JWT Secret (from `Project Settings` > `API` > `JWT Settings` in Supabase Dashboard) for your backend to sign custom JWTs.

---

## Phase 1: Database Cleanup (From Previous Auth)

**Status: COMPLETED** (Assuming Clerk cleanup was successful)

This section ensures any remnants of a previous authentication system (like Clerk) are removed.

```sql
-- Drop Clerk-specific new user handler function and trigger (if not already done)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop Clerk-specific helper functions for RLS (if not already done)
DROP FUNCTION IF EXISTS public.current_user_id_text() CASCADE; -- CASCADE will drop dependent RLS policies

-- RLS policies that depended on the above function are now dropped.
-- We will recreate them based on Moralis authentication.

-- Ensure auth.users table is clean if necessary. For Moralis, users might not
-- directly populate auth.users in the same way unless you explicitly design it.
-- The primary link will be the EVM address in your custom JWT and public.profiles.id.
-- Consider if you need to clear out old test users from auth.users.
-- e.g., DELETE FROM auth.users WHERE ...; -- Use with caution.
```

---

## Phase 2: Table Structure Review

**Status: MOSTLY COMPLETED** (Tables exist, `profiles.id` to store EVM address)

The existing tables (`profiles`, `games`, `moves`) and `game_status_enum` type are largely compatible. The key change is that `public.profiles.id` will now store the user's EVM address (a `TEXT` type, which is suitable).

### 2.1. `profiles` Table

Stores user-specific information. The `id` will be the user's EVM address.

```sql
-- Verify or Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY, -- EVM Address (e.g., 0x123...)
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE, -- Optional, may not be available from Web3 login
    avatar_url TEXT,
    gems INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Stores user profile information, linked to EVM addresses via Moralis auth.';
COMMENT ON COLUMN public.profiles.id IS 'User's EVM Address, serves as the primary key.';
COMMENT ON COLUMN public.profiles.username IS 'Unique username, potentially derived or user-set post-signup.';
```

### 2.2. `game_status_enum` Type

(No changes needed from previous version)
```sql
CREATE TYPE public.game_status_enum AS ENUM (
    'waiting',
    'active',
    'completed',
    'expired',
    'abandoned'
);
```

### 2.3. `games` Table

(No changes needed, foreign keys `player1_id`, `player2_id`, `winner_id` will reference `profiles.id` which is now EVM address)
```sql
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    player2_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    bet_amount INTEGER NOT NULL DEFAULT 0,
    status public.game_status_enum NOT NULL DEFAULT 'waiting',
    winner_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);
COMMENT ON COLUMN public.games.player1_id IS 'Creator of the game (EVM Address).';
COMMENT ON COLUMN public.games.player2_id IS 'Second player in the game (EVM Address).';
```

### 2.4. `moves` Table

(No changes needed, foreign key `player_id` will reference `profiles.id` which is now EVM address)
```sql
CREATE TABLE IF NOT EXISTS public.moves (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- EVM Address
    action_type TEXT NOT NULL,
    payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.moves.player_id IS 'The player who made the move (EVM Address).';
```

---

## Phase 3: Core Functions

**Status: COMPLETED**

### 3.1. `update_updated_at_column()` Function

(No changes needed from previous version)
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to profiles table (if not already existing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at') THEN
    CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Apply trigger to games table (if not already existing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_games_updated_at') THEN
    CREATE TRIGGER set_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
```

### 3.2. `handle_new_moralis_user()` Function

This function will be triggered when a new user is authenticated via Moralis and a corresponding entry needs to be created or updated in `public.profiles`.
Unlike the Clerk integration which relied on `auth.users` trigger, this function will likely be called *manually* by your backend *after* it has successfully verified the Moralis authentication and *before or during* the custom Supabase JWT minting.
Alternatively, if you decide to mirror users into `auth.users` using the admin SDK from your backend, this could be an `AFTER INSERT ON auth.users` trigger again, but the `NEW.id` and `NEW.raw_user_meta_data` would need to be populated correctly by your backend.

For a simpler approach, let's assume your backend calls this function directly using the Supabase client with service_role privileges, or you adapt it to be a trigger if you populate `auth.users`.

**Option A: Function called by backend (e.g. after Moralis verify, before JWT minting)**
Your backend would call this with the EVM address and any other details.

```sql
CREATE OR REPLACE FUNCTION public.ensure_user_profile_exists(
    p_evm_address TEXT,
    p_username TEXT DEFAULT NULL, -- Optional: username might be set later or derived
    p_email TEXT DEFAULT NULL,    -- Optional: email might not be available
    p_avatar_url TEXT DEFAULT NULL -- Optional: avatar_url might not be available
)
RETURNS TABLE(id TEXT, username TEXT, email TEXT, avatar_url TEXT, gems INT, games_played INT, games_won INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER -- Or SECURITY INVOKER if called by a trusted backend role
AS $$
DECLARE
    v_final_username TEXT;
    v_profile record;
BEGIN
    -- Default username if not provided: "Player" + last 6 chars of EVM address
    IF p_username IS NULL OR p_username = '' THEN
        v_final_username := 'Player_' || right(p_evm_address, 6);
    ELSE
        v_final_username := p_username;
    END IF;

    INSERT INTO public.profiles (id, username, email, avatar_url)
    VALUES (p_evm_address, v_final_username, p_email, p_avatar_url)
    ON CONFLICT (id) DO UPDATE SET
        -- Only update if new values are provided and different, or on first insert
        -- For simplicity, we can just update updated_at or specific fields if needed
        -- username = EXCLUDED.username, -- Be careful with username updates on conflict
        updated_at = now()
    RETURNING * INTO v_profile;
    
    -- If username conflicted, ensure it's handled or a unique one is generated
    IF NOT FOUND THEN
      -- This block might be redundant if ON CONFLICT DO UPDATE always returns the row.
      -- However, if the insert was skipped due to conflict and no update happened (e.g. no fields changed)
      -- we might need to select the existing profile.
      SELECT * INTO v_profile FROM public.profiles WHERE profiles.id = p_evm_address;
    END IF;

    -- If username caused a unique constraint violation on the initial insert attempt (not caught by ON CONFLICT (id))
    -- This part is tricky. A robust solution might involve a loop or a different unique username generation strategy.
    -- For now, we assume `ON CONFLICT (id)` handles the primary key, and username uniqueness is managed by the caller or UI.

    RETURN QUERY SELECT * FROM public.profiles WHERE profiles.id = p_evm_address;
END;
$$;
```
**Note on `handle_new_moralis_user`:** The `sub` claim in your custom Supabase JWT (see Phase 6) should be the user's EVM address. This EVM address will be what `auth.uid()` returns in your RLS policies.

---

## Phase 4: Row Level Security (RLS) Policies (Moralis Based)

**Status: COMPLETED**

Enable RLS for all tables. `auth.uid()` will return the EVM address from the custom Supabase JWT.

```sql
-- Enable RLS for all tables (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Force RLS for owners (good practice)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.games FORCE ROW LEVEL SECURITY;
ALTER TABLE public.moves FORCE ROW LEVEL SECURITY;

-- Drop old RLS policies before creating new ones to avoid conflicts
-- (CASCADE from function drop in Phase 1 should have handled many, but be explicit if needed)
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
-- ... drop other old game and move policies ...

-- RLS Policies for public.profiles
-- Assumes auth.uid() returns the EVM address
CREATE POLICY "Allow public read access to profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- Note: Inserts into profiles are handled by the ensure_user_profile_exists function.
-- No direct RLS insert policy for users on profiles table needed if using the function approach.

-- RLS Policies for public.games
CREATE POLICY "Allow authenticated users to view active/waiting games"
  ON public.games FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow players to view their own games"
  ON public.games FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Allow authenticated users to create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND player1_id = auth.uid());

CREATE POLICY "Allow players to update their own games"
  ON public.games FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id)
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- RLS Policies for public.moves
CREATE POLICY "Allow players to view moves in their games"
  ON public.moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.games g
      WHERE g.id = moves.game_id AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
    )
  );

CREATE POLICY "Allow players to insert moves in their active games"
  ON public.moves FOR INSERT
  WITH CHECK (
    player_id = auth.uid() AND
    EXISTS (
      SELECT 1
      FROM public.games g
      WHERE g.id = moves.game_id AND g.status = 'active' AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
    )
  );
-- No update/delete on moves to maintain game history integrity.
```

---

## Phase 5: Storage (Avatars - EVM Address Based)

**Status: COMPLETED**

Configure storage for user avatars. Folder names will be the user's EVM address.

```sql
-- Create the 'avatars' bucket (if not exists, via UI or SQL)
-- Ensure it's a PUBLIC bucket if you want direct public URL access after RLS checks.

-- Drop old storage RLS policies
DROP POLICY IF EXISTS "Allow public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to their own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own avatar files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own avatar files" ON storage.objects;

-- RLS Policies for storage.objects (bucket_id = 'avatars')
-- Assumes auth.uid() returns the EVM address.
-- Folder structure: /avatars/{evm_address}/filename.ext

CREATE POLICY "Allow public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars'); -- Or more restrictive if needed

CREATE POLICY "Allow authenticated users to upload to their own avatar folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = (storage.foldername(name))[1] -- Extracts first part of path as folder name
  );

CREATE POLICY "Allow authenticated users to update their own avatar files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid() = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = (storage.foldername(name))[1]
  );

CREATE POLICY "Allow authenticated users to delete their own avatar files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid() = (storage.foldername(name))[1]
  );
```

---

## Phase 6: Backend Authentication Flow (Moralis + Supabase JWT)

**Status: COMPLETED (Edge Function Deployed - Verify Secrets)**

Supabase Edge Function `moralis-auth` has been created and deployed.
Crucial steps for this phase to be fully operational:
1.  **Verify Secrets:** Ensure the correct `MORALIS_API_KEY` (non-JWT string) and `SUPABASE_JWT_SECRET` (long signing key string) are used.
2.  **Set Environment Variables in Supabase Dashboard:** For the deployed `moralis-auth` function, these secrets (along with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) MUST be set in the function's environment variable settings in the Supabase Dashboard.
3.  Local `.env` files are for local testing only and do not affect the deployed function.

You need a backend service (e.g., Node.js/Express, or a Supabase Edge Function) to handle the Moralis authentication flow.
Refer to: [Moralis Supabase Integration (Node.js)](https://docs.moralis.io/authentication-api/evm/integrations/supabase-nodejs)

**Core Steps for your Backend:**

1.  **Frontend Initiates:**
    *   Frontend uses Moralis SDK to get the user to sign a message (`requestMessage`).
    *   Frontend sends the signed message and related data to your backend.
2.  **Backend Verifies:**
    *   Your backend receives the signed message.
    *   Uses Moralis Admin SDK (`Moralis.Auth.verify()`) to verify the message. This confirms the user owns the EVM address.
    *   The verification response will include the user's EVM address and profile ID.
3.  **Backend Creates/Updates Profile (Optional but Recommended Here):**
    *   After successful verification, your backend should call the `public.ensure_user_profile_exists` function in Supabase using the service_role key to create or update the user's profile in `public.profiles`.
    *   This ensures the profile exists before a JWT is minted for it.
4.  **Backend Mints Supabase JWT:**
    *   If verification is successful, your backend mints a custom Supabase JWT.
    *   The JWT payload **MUST** include:
        *   `sub`: The user's EVM address (this is crucial for `auth.uid()` to work correctly).
        *   `role`: 'authenticated' (or other roles as needed).
        *   `exp`: Expiration time.
        *   Any other custom claims you want (e.g., `app_metadata`, `user_metadata`).
    *   Sign this JWT using your Supabase Project's JWT Secret.
5.  **Backend Responds:**
    *   Backend sends the newly minted Supabase JWT back to the frontend.
6.  **Frontend Stores JWT:**
    *   Frontend stores this JWT (e.g., in localStorage) and uses it to initialize the Supabase client (`supabase.auth.setSession()`).

**Example Backend Snippet (Conceptual Node.js/Express):**

```javascript
// main.ts or server.ts (Node.js/Express example)
// import Moralis from 'moralis';
// import { createClient } from '@supabase/supabase-js';
// import jwt from 'jsonwebtoken'; // Or import from 'jose' for modern JS

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // For calling ensure_user_profile_exists
// const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
// const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Moralis.start({ apiKey: process.env.MORALIS_API_KEY });

// app.post('/auth/moralis/verify', async (req, res) => {
//   try {
//     const { message, signature } = req.body;
//     const result = await Moralis.Auth.verify({ message, signature, networkType: 'evm' });
//     const { address, profileId } = result.toJSON(); // EVM address

//     // 3. Ensure profile exists in Supabase
//     const { data: profile, error: profileError } = await supabase
//       .rpc('ensure_user_profile_exists', { p_evm_address: address });

//     if (profileError) throw profileError;
//     if (!profile || profile.length === 0) throw new Error('Profile creation/retrieval failed');

//     // 4. Mint Supabase JWT
//     const payload = {
//       sub: address, // User's EVM address
//       role: 'authenticated',
//       email: profile[0].email, // Optional: include email if available from profile
//       user_metadata: { username: profile[0].username, avatar_url: profile[0].avatar_url },
//       exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 1 week expiration
//     };
//     const token = jwt.sign(payload, supabaseJwtSecret);

//     return res.status(200).json({ token, user: profile[0] });
//   } catch (error) {
//     console.error("Moralis verification or JWT minting error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// });
```

---

## Phase 7: Frontend Integration (Moralis SDK)

**Status: COMPLETED**

Frontend integration with Moralis and Supabase custom JWT authentication. This phase ensures users can connect their wallet, authenticate via Moralis, and receive a Supabase session using the Edge Function.

### Implementation Checklist

1. [x] **Install Moralis SDK:**
    - `npm install moralis` in the `mythical-beings-mvp` directory.
2. [x] **Initialize Moralis in frontend:**
    - In `src/main.tsx` or `src/App.tsx`:
      ```typescript
      import Moralis from "moralis";
      Moralis.start({ apiKey: import.meta.env.VITE_MORALIS_API_KEY });
      ```
    - Add `VITE_MORALIS_API_KEY` to `.env.local`.
3. [x] **Implement wallet connection and authentication flow:**
    - Created `wallet.ts` utility with:
      - `connectWallet()` - Uses ethers.js to connect to MetaMask
      - `authenticateWithMoralis()` - Full auth flow with message signing
      - `signOut()` - Handles logging out
4. [x] **Handle Edge Function response:**
    - Receive `{ token, user }` from `moralis-auth` Edge Function
    - Set Supabase session with received token
5. [x] **Update user identification hook:**
    - Updated `usePlayerIdentification.ts` to read EVM address from Supabase session
    - Uses `supabase.auth.getSession()` and `onAuthStateChange` to track auth state
6. [x] **Implement UI for wallet connection:**
    - Added connect wallet button to Home page
    - Updated NavBar to show connected wallet address and sign out button
7. [x] **Test full login and session flow.**

---

## Phase 8: Testing Checklist (Moralis)

**Status: COMPLETED**

1.  **Moralis Setup:**
    *   [x] Moralis account created, API key obtained.
    *   [x] Moralis SDK initialized in frontend.
2.  **Backend Setup (Node.js/Express or Supabase Edge Function):**
    *   [x] Endpoint for `/auth/moralis/verify` (or similar) created (Edge Function: `moralis-auth`).
    *   [x] Moralis Admin SDK/API configured with API key.
    *   [x] Supabase client (with service role key) configured for calling `ensure_user_profile_exists`.
    *   [x] Supabase JWT Secret configured for minting custom JWTs (as `JWT_SECRET`).
3.  **Database Schema & Functions:**
    *   [x] All SQL from Phases 1-5 successfully executed.
    *   [x] `profiles.id` is TEXT and intended for EVM addresses.
    *   [x] `ensure_user_profile_exists` function is created and works.
    *   [x] RLS policies are active and correctly use `auth.uid()` (which should be EVM address).
4.  **New User Signup/Login (Moralis Flow):**
    *   [x] Connect wallet (e.g., MetaMask) on the frontend.
    *   [x] Successfully request a message from Moralis via backend.
    *   [x] User signs the message.
    *   [x] Backend successfully verifies the signature with Moralis.
    *   [x] Backend calls `ensure_user_profile_exists`; verify a new entry (or update) in `public.profiles` with:
        *   [x] `id` as the EVM address.
        *   [x] `username` populated (e.g., default "Player_xxxxxx" or from input).
    *   [x] Backend successfully mints a Supabase JWT with `sub` claim as the EVM address.
    *   [x] Frontend receives the JWT and sets the Supabase session.
    *   [x] `supabase.auth.user().id` on the frontend correctly shows the EVM address.
5.  **Authenticated Operations (Post-Login):**
    *   [x] User can fetch their own profile from `public.profiles` using their EVM address.
    *   [x] User can update their profile.
    *   [x] Game creation, joining, playing moves work using EVM address as identifier.
    *   [x] Avatar uploads work, storing files under `/avatars/{evm_address}/`.
6.  **RLS Enforcement:**
    *   [x] Test that users cannot access/modify data they don't own (e.g., another user's profile, moves in other games) based on EVM address.
7.  **Logout:**
    *   [x] `supabase.auth.signOut()` clears the session.
    *   [x] User needs to reconnect wallet and re-authenticate to get a new session.

---
