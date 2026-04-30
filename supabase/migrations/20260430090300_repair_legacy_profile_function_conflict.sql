-- Repair ambiguity in the legacy wallet profile helper used by older auth paths.
-- The function returns a column named id, so ON CONFLICT (id) can be parsed as
-- either the return variable or the profiles column. Use the explicit
-- constraint form to keep the function lint-clean.

create or replace function public.ensure_user_profile_exists(
  p_evm_address text,
  p_user_id uuid default null
)
returns table(id uuid, username text, avatar_url text, eth_address text, games_played int, games_won int, created_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
as $$
declare
  v_final_username text;
  v_profile record;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  v_final_username := 'Player_' || substring(p_evm_address, 3, 6);

  insert into public.profiles (id, username, eth_address, created_at, updated_at)
  values (p_user_id, v_final_username, lower(p_evm_address), now(), now())
  on conflict on constraint profiles_pkey do update set
    username = coalesce(public.profiles.username, excluded.username),
    eth_address = excluded.eth_address,
    updated_at = now()
  returning * into v_profile;

  return query select
    v_profile.id,
    v_profile.username,
    v_profile.avatar_url,
    v_profile.eth_address,
    v_profile.games_played,
    v_profile.games_won,
    v_profile.created_at,
    v_profile.updated_at;
end;
$$;

revoke execute on function public.ensure_user_profile_exists(text, uuid) from authenticated;
grant execute on function public.ensure_user_profile_exists(text, uuid) to service_role;
