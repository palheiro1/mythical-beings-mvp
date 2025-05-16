-- This SQL script updates RLS policies for the Mythical Beings game
-- to support both raw ETH addresses and UUID-formatted addresses

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
    (is_same_user(player1_id, auth.uid()) OR player1_id = auth.uid())
  );

-- Update policy for game updates
DROP POLICY IF EXISTS "Allow players to update their own games" ON public.games;

CREATE POLICY "Allow players to update their own games"
  ON public.games FOR UPDATE
  USING (
    is_same_user(player1_id, auth.uid()) OR 
    is_same_user(player2_id, auth.uid()) OR
    player1_id = auth.uid() OR 
    player2_id = auth.uid()
  )
  WITH CHECK (
    is_same_user(player1_id, auth.uid()) OR 
    is_same_user(player2_id, auth.uid()) OR
    player1_id = auth.uid() OR 
    player2_id = auth.uid()
  );

-- Update the selection policy
DROP POLICY IF EXISTS "Allow players to view their own games" ON public.games;

CREATE POLICY "Allow players to view their own games"
  ON public.games FOR SELECT
  USING (
    is_same_user(player1_id, auth.uid()) OR 
    is_same_user(player2_id, auth.uid()) OR
    player1_id = auth.uid() OR 
    player2_id = auth.uid()
  );
