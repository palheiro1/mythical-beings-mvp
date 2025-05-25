-- This SQL script updates RLS policies for the Mythical Beings game
-- to support both raw ETH addresses and UUID-formatted addresses

-- Make sure the games table exists first
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    player1_id TEXT NOT NULL,  -- Changed from UUID with foreign key to TEXT to support both ETH addresses and UUIDs
    player2_id TEXT,           -- Changed from UUID with foreign key to TEXT to support both ETH addresses and UUIDs
    status TEXT DEFAULT 'waiting' NOT NULL,
    state JSONB,
    bet_amount NUMERIC DEFAULT 0,
    player1_selected_creatures TEXT[] DEFAULT '{}',
    player2_selected_creatures TEXT[] DEFAULT '{}',
    player1_selection_complete BOOLEAN DEFAULT FALSE,
    player2_selection_complete BOOLEAN DEFAULT FALSE,
    player1_dealt_hand TEXT[] DEFAULT '{}',
    player2_dealt_hand TEXT[] DEFAULT '{}'
);

-- First, create a helper function to convert between formats
CREATE OR REPLACE FUNCTION public.is_same_user(user_id_1 TEXT, user_id_2 TEXT) 
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Helper function to clean and normalize an ETH address
  clean_address_1 TEXT;
  clean_address_2 TEXT;
BEGIN
  -- Handle null inputs
  IF user_id_1 IS NULL OR user_id_2 IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If they're already exactly equal, return true
  IF user_id_1 = user_id_2 THEN
    RETURN TRUE;
  END IF;
  
  -- If either looks like a UUID (contains hyphens)
  IF user_id_1 LIKE '%-%' OR user_id_2 LIKE '%-%' THEN
    -- Convert ETH address to lowercase and remove 0x prefix
    clean_address_1 := LOWER(REPLACE(user_id_1, '0x', ''));
    clean_address_2 := LOWER(REPLACE(user_id_2, '0x', ''));
    
    -- Remove hyphens from UUIDs
    clean_address_1 := REPLACE(clean_address_1, '-', '');
    clean_address_2 := REPLACE(clean_address_2, '-', '');
    
    -- Compare the normalized versions
    RETURN SUBSTRING(clean_address_1, 1, 32) = SUBSTRING(clean_address_2, 1, 32);
  END IF;
  
  -- If they're both raw addresses, just compare directly
  RETURN user_id_1 = user_id_2;
END;
$$;

-- Update the RLS policy for game creation
DROP POLICY IF EXISTS "Allow authenticated users to create games" ON public.games;

CREATE POLICY "Allow authenticated users to create games"
  ON public.games FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND 
    (is_same_user(player1_id::text, auth.uid()::text) OR player1_id::text = auth.uid()::text)
  );

-- Update policy for game updates
DROP POLICY IF EXISTS "Allow players to update their own games" ON public.games;

CREATE POLICY "Allow players to update their own games"
  ON public.games FOR UPDATE
  USING (
    is_same_user(player1_id::text, auth.uid()::text) OR 
    is_same_user(player2_id::text, auth.uid()::text) OR
    player1_id::text = auth.uid()::text OR 
    player2_id::text = auth.uid()::text
  )
  WITH CHECK (
    is_same_user(player1_id::text, auth.uid()::text) OR 
    is_same_user(player2_id::text, auth.uid()::text) OR
    player1_id::text = auth.uid()::text OR 
    player2_id::text = auth.uid()::text
  );

-- Update the selection policy
DROP POLICY IF EXISTS "Allow players to view their own games" ON public.games;

CREATE POLICY "Allow players to view their own games"
  ON public.games FOR SELECT
  USING (
    is_same_user(player1_id::text, auth.uid()::text) OR 
    is_same_user(player2_id::text, auth.uid()::text) OR
    player1_id::text = auth.uid()::text OR 
    player2_id::text = auth.uid()::text
  );
  
-- Add an admin policy to allow service role to bypass RLS
DROP POLICY IF EXISTS "Allow service role to manage all games" ON public.games;

CREATE POLICY "Allow service role to manage all games"
  ON public.games
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
