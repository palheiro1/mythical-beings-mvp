-- Create function to ensure user profile exists when called by Moralis auth
CREATE OR REPLACE FUNCTION public.ensure_user_profile_exists(
    p_evm_address TEXT,
    p_username TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS TABLE(id TEXT, username TEXT, email TEXT, avatar_url TEXT, games_played INT, games_won INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_final_username TEXT;
    v_profile record;
    v_uuid_format TEXT;
BEGIN
    -- Convert ETH address to UUID format for storage and consistent reference
    -- This must match the ethAddressToUUID implementation in JavaScript
    v_uuid_format := public.eth_address_to_uuid(p_evm_address);
    
    -- Default username if not provided
    IF p_username IS NULL OR p_username = '' THEN
        v_final_username := 'Player_' || substring(p_evm_address, 3, 6);
    ELSE
        v_final_username := p_username;
    END IF;

    -- Insert or update profile
    INSERT INTO public.profiles (id, username, eth_address, avatar_url, created_at, updated_at)
    VALUES (
        v_uuid_format, 
        v_final_username, 
        p_evm_address,
        p_avatar_url,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(profiles.username, EXCLUDED.username),
        eth_address = COALESCE(profiles.eth_address, EXCLUDED.eth_address),
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = now()
    RETURNING * INTO v_profile;
    
    -- Return the profile data
    RETURN QUERY SELECT 
        v_profile.id, 
        v_profile.username, 
        NULL::text AS email, -- No email field in current schema
        v_profile.avatar_url,
        v_profile.games_played,
        v_profile.games_won,
        v_profile.created_at,
        v_profile.updated_at;
END;
$$;

-- Create function to convert ETH address to UUID format (matching JS implementation)
CREATE OR REPLACE FUNCTION public.eth_address_to_uuid(address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    clean_address TEXT;
    normalized_hex TEXT;
BEGIN
    -- Remove 0x prefix and ensure lowercase
    clean_address := lower(replace(address, '0x', ''));
    
    -- Pad or truncate to ensure exactly 32 hex characters
    normalized_hex := clean_address;
    IF length(normalized_hex) > 32 THEN
        normalized_hex := substring(normalized_hex, 1, 32);
    ELSE
        WHILE length(normalized_hex) < 32 LOOP
            normalized_hex := normalized_hex || '0';
        END LOOP;
    END IF;
    
    -- Format as UUID
    RETURN 
        substring(normalized_hex, 1, 8) || '-' ||
        substring(normalized_hex, 9, 4) || '-' ||
        substring(normalized_hex, 13, 4) || '-' ||
        substring(normalized_hex, 17, 4) || '-' ||
        substring(normalized_hex, 21, 12);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_exists TO service_role;
GRANT EXECUTE ON FUNCTION public.eth_address_to_uuid TO authenticated;
GRANT EXECUTE ON FUNCTION public.eth_address_to_uuid TO service_role;
