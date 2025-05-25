-- Create a stored procedure for ensuring profiles exist
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
