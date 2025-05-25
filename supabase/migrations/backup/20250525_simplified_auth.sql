-- Simplified Authentication Schema
-- This migration simplifies the authentication system to use Supabase Auth as the single source of truth

-- Update the ensure_user_profile_exists function to work with Supabase Auth user IDs
CREATE OR REPLACE FUNCTION public.ensure_user_profile_exists(
    p_evm_address TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, username TEXT, avatar_url TEXT, eth_address TEXT, games_played INT, games_won INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_final_username TEXT;
    v_user_id UUID;
    v_profile record;
BEGIN
    -- Use provided user_id or generate one from ETH address for backward compatibility
    IF p_user_id IS NOT NULL THEN
        v_user_id := p_user_id;
    ELSE
        -- Fallback: generate UUID from ETH address (for backward compatibility)
        v_user_id := gen_random_uuid();
    END IF;
    
    -- Default username if not provided
    v_final_username := 'Player_' || substring(p_evm_address, 3, 6);

    -- Insert or update profile using the Supabase Auth user ID
    INSERT INTO public.profiles (id, username, eth_address, created_at, updated_at)
    VALUES (
        v_user_id, 
        v_final_username, 
        p_evm_address,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(profiles.username, EXCLUDED.username),
        eth_address = EXCLUDED.eth_address, -- Always update ETH address
        updated_at = now()
    RETURNING * INTO v_profile;
    
    -- Return the profile data
    RETURN QUERY SELECT 
        v_profile.id, 
        v_profile.username, 
        v_profile.avatar_url,
        v_profile.eth_address,
        v_profile.games_played,
        v_profile.games_won,
        v_profile.created_at,
        v_profile.updated_at;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_exists TO service_role;

-- Update RLS policies to use auth.uid() directly
-- This simplifies the policies since we'll use Supabase Auth user IDs directly

-- Drop existing complex policies
DROP POLICY IF EXISTS "Allow players to view their own games" ON public.games;
DROP POLICY IF EXISTS "Allow authenticated users to create games" ON public.games;
DROP POLICY IF EXISTS "Allow players to update their own games" ON public.games;

-- Create simplified policies using auth.uid()
CREATE POLICY "Allow players to view their own games"
  ON public.games FOR SELECT
  USING (
    player1_id = auth.uid() OR 
    player2_id = auth.uid()
  );

CREATE POLICY "Allow authenticated users to create games"
  ON public.games FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (player1_id = auth.uid() OR player2_id = auth.uid())
  );

CREATE POLICY "Allow players to update their own games"
  ON public.games FOR UPDATE
  USING (
    player1_id = auth.uid() OR 
    player2_id = auth.uid()
  );

-- Update profiles policies
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

CREATE POLICY "Allow users to view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Allow authenticated users to create profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- Update moves policies
DROP POLICY IF EXISTS "Allow players to view moves for their games" ON public.moves;
DROP POLICY IF EXISTS "Allow players to insert moves for their games" ON public.moves;

CREATE POLICY "Allow players to view moves for their games"
  ON public.moves FOR SELECT
  USING (
    player_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );

CREATE POLICY "Allow players to insert moves for their games"
  ON public.moves FOR INSERT
  WITH CHECK (
    player_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
    )
  );
