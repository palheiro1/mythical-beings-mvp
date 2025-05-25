-- Simplified Authentication Functions and Policies
-- This migration adds the simplified authentication functions for Supabase-only auth

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
