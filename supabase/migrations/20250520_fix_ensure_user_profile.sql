-- This fixes the ensure_user_profile_exists function to use UUID formatted ETH addresses
-- The issue is that the JWT 'sub' claim is in UUID format but the profile ID was using raw ETH address
-- This needs to be consistent for the Supabase auth system to properly match users with profiles

-- Helper function to convert ETH address to UUID format
CREATE OR REPLACE FUNCTION eth_address_to_uuid(address TEXT) 
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  clean_address TEXT;
  normalized_hex TEXT;
BEGIN
  -- Remove 0x prefix and ensure lowercase
  clean_address := LOWER(REPLACE(address, '0x', ''));
  
  -- Pad or truncate to ensure we have exactly 32 hex characters (16 bytes)
  normalized_hex := clean_address;
  IF LENGTH(normalized_hex) > 32 THEN
    normalized_hex := SUBSTRING(normalized_hex, 1, 32);
  ELSE
    WHILE LENGTH(normalized_hex) < 32 LOOP
      normalized_hex := normalized_hex || '0';
    END LOOP;
  END IF;
  
  -- Format as UUID
  RETURN 
    SUBSTRING(normalized_hex, 1, 8) || '-' ||
    SUBSTRING(normalized_hex, 9, 4) || '-' ||
    SUBSTRING(normalized_hex, 13, 4) || '-' ||
    SUBSTRING(normalized_hex, 17, 4) || '-' ||
    SUBSTRING(normalized_hex, 21, 12);
END;
$$;

-- Update the ensure_user_profile_exists function to use UUID formatted addresses
CREATE OR REPLACE FUNCTION ensure_user_profile_exists(
    p_evm_address TEXT,
    p_username TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
) RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_final_username TEXT;
    v_profile public.profiles%ROWTYPE;
    v_uuid_address TEXT;
BEGIN
    -- Convert the ETH address to UUID format for consistent ID
    v_uuid_address := eth_address_to_uuid(p_evm_address);
    
    -- Default username if not provided or empty: "Player_" + last 6 chars of EVM address
    IF p_username IS NULL OR p_username = '' THEN
        v_final_username := 'Player_' || right(p_evm_address, 6);
    ELSE
        v_final_username := p_username;
    END IF;

    INSERT INTO public.profiles (id, username, email, avatar_url, eth_address, created_at, updated_at)
    VALUES (v_uuid_address, v_final_username, p_email, p_avatar_url, p_evm_address, now(), now())
    ON CONFLICT ON CONSTRAINT profiles_pkey DO UPDATE SET
        username = CASE
                       WHEN p_username IS NOT NULL AND NULLIF(p_username, '') IS NOT NULL AND p_username <> public.profiles.username THEN p_username
                       ELSE public.profiles.username
                   END,
        email = CASE
                    WHEN p_email IS NOT NULL AND NULLIF(p_email, '') IS NOT NULL AND p_email <> public.profiles.email THEN p_email
                    ELSE public.profiles.email
                END,
        avatar_url = CASE
                         WHEN p_avatar_url IS NOT NULL AND NULLIF(p_avatar_url, '') IS NOT NULL AND p_avatar_url <> public.profiles.avatar_url THEN p_avatar_url
                         ELSE public.profiles.avatar_url
                     END,
        eth_address = p_evm_address, -- Store original ETH address in dedicated field
        updated_at = now()
    RETURNING * INTO v_profile;
    
    IF v_profile.id IS NULL THEN
        SELECT * INTO v_profile FROM public.profiles WHERE public.profiles.id = v_uuid_address;
    END IF;

    RETURN QUERY SELECT * FROM public.profiles WHERE public.profiles.id = v_profile.id;
END;
$$;

-- Also create a function to repair existing profiles that might have incorrect IDs
CREATE OR REPLACE FUNCTION repair_profile_ids() 
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_rec RECORD;
  uuid_format TEXT;
BEGIN
  FOR profile_rec IN 
    SELECT * FROM profiles 
    WHERE id NOT LIKE '%-%' AND id LIKE '0x%'
  LOOP
    -- Generate UUID format for this ETH address
    uuid_format := eth_address_to_uuid(profile_rec.id);
    
    -- Insert new record with UUID format and preserve original ETH address
    INSERT INTO profiles (
      id, 
      username, 
      email,
      avatar_url,
      eth_address,
      created_at, 
      updated_at,
      games_played,
      games_won
    ) VALUES (
      uuid_format,
      profile_rec.username,
      profile_rec.email,
      profile_rec.avatar_url,
      profile_rec.id, -- store original ETH address here
      profile_rec.created_at,
      now(),
      profile_rec.games_played,
      profile_rec.games_won
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Delete the old record if new one was created successfully
    IF FOUND THEN
      DELETE FROM profiles WHERE id = profile_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION ensure_user_profile_exists TO authenticated;
GRANT EXECUTE ON FUNCTION eth_address_to_uuid TO authenticated;
