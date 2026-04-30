-- Repair Card Game registration in the shared Play Hub schema.
-- This migration is intentionally additive/idempotent and does not change other games.

insert into public.games (id, slug, display_name, description, metadata)
values (
  'card_game',
  'card-game',
  'Mythical Beings Card Game',
  'Two-player tactical Mythical Beings card game.',
  jsonb_build_object('namespace', 'card_game')
)
on conflict (id) do update
set slug = excluded.slug,
    display_name = excluded.display_name,
    description = excluded.description,
    metadata = excluded.metadata,
    is_enabled = true,
    updated_at = now();

insert into public.game_modes (game_id, id, display_name, min_players, max_players, settings)
values (
  'card_game',
  'casual',
  'Casual',
  2,
  2,
  jsonb_build_object('players', 2)
)
on conflict (game_id, id) do update
set display_name = excluded.display_name,
    min_players = excluded.min_players,
    max_players = excluded.max_players,
    settings = excluded.settings,
    is_enabled = true,
    updated_at = now();

insert into public.leaderboard_seasons (
  id,
  game_id,
  mode_id,
  display_name,
  starts_at,
  ends_at,
  is_active,
  metadata
)
values (
  'card_game_casual_season_1',
  'card_game',
  'casual',
  'Card Game Casual Season 1',
  now(),
  null,
  true,
  jsonb_build_object('metric', 'season_points')
)
on conflict (id) do update
set display_name = excluded.display_name,
    is_active = excluded.is_active,
    metadata = excluded.metadata,
    updated_at = now();

create table if not exists public.card_game_session_state (
  session_id uuid primary key references public.game_sessions(id) on delete cascade,
  dealt_hands jsonb not null default '{}'::jsonb,
  selected_creatures jsonb not null default '{}'::jsonb,
  state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.card_game_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_card_game_session_state_updated_at on public.card_game_session_state;
create trigger trg_card_game_session_state_updated_at
before update on public.card_game_session_state
for each row execute function public.card_game_touch_updated_at();

alter table public.card_game_session_state enable row level security;

create or replace function public.card_game_is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_participants sp
    where sp.session_id = p_session_id
      and sp.player_id = auth.uid()
  );
$$;

create or replace function public.card_game_is_session_host(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_sessions gs
    where gs.id = p_session_id
      and gs.host_id = auth.uid()
      and gs.game_id = 'card_game'
      and gs.mode_id = 'casual'
  );
$$;

drop policy if exists "Card game state readable by participants" on public.card_game_session_state;
create policy "Card game state readable by participants"
on public.card_game_session_state
for select
using (public.card_game_is_session_participant(session_id));

revoke all on public.card_game_session_state from anon, authenticated;
grant select on public.card_game_session_state to authenticated;

create or replace function public.card_game_get_session_state(p_session_id uuid)
returns table (
  session_id uuid,
  dealt_hands jsonb,
  selected_creatures jsonb,
  state jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.card_game_is_session_participant(p_session_id) then
    raise exception 'not a participant';
  end if;

  insert into public.card_game_session_state (session_id)
  values (p_session_id)
  on conflict on constraint card_game_session_state_pkey do nothing;

  return query
  select s.session_id, s.dealt_hands, s.selected_creatures, s.state, s.created_at, s.updated_at
  from public.card_game_session_state s
  where s.session_id = p_session_id;
end;
$$;

create or replace function public.card_game_set_selection(
  p_session_id uuid,
  p_selected_creatures text[]
)
returns table (
  session_id uuid,
  dealt_hands jsonb,
  selected_creatures jsonb,
  state jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot int;
begin
  if coalesce(array_length(p_selected_creatures, 1), 0) <> 3 then
    raise exception 'exactly three creatures are required';
  end if;

  select sp.slot into v_slot
  from public.session_participants sp
  join public.game_sessions gs on gs.id = sp.session_id
  where sp.session_id = p_session_id
    and sp.player_id = auth.uid()
    and gs.game_id = 'card_game'
    and gs.mode_id = 'casual'
    and gs.status in ('waiting', 'playing');

  if v_slot is null then
    raise exception 'not a participant';
  end if;

  insert into public.card_game_session_state (session_id, selected_creatures)
  values (
    p_session_id,
    jsonb_build_object(v_slot::text, to_jsonb(p_selected_creatures))
  )
  on conflict on constraint card_game_session_state_pkey do update
  set selected_creatures = jsonb_set(
        coalesce(public.card_game_session_state.selected_creatures, '{}'::jsonb),
        array[v_slot::text],
        to_jsonb(p_selected_creatures),
        true
      );

  return query
  select s.session_id, s.dealt_hands, s.selected_creatures, s.state, s.created_at, s.updated_at
  from public.card_game_session_state s
  where s.session_id = p_session_id;
end;
$$;

create or replace function public.card_game_set_state(
  p_session_id uuid,
  p_state jsonb
)
returns table (
  session_id uuid,
  dealt_hands jsonb,
  selected_creatures jsonb,
  state jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.card_game_is_session_participant(p_session_id) then
    raise exception 'not a participant';
  end if;

  if not exists (
    select 1
    from public.game_sessions gs
    where gs.id = p_session_id
      and gs.game_id = 'card_game'
      and gs.mode_id = 'casual'
      and gs.status = 'playing'
  ) then
    raise exception 'session is not playable';
  end if;

  insert into public.card_game_session_state (session_id, state)
  values (p_session_id, p_state)
  on conflict on constraint card_game_session_state_pkey do update
  set state = excluded.state;

  return query
  select s.session_id, s.dealt_hands, s.selected_creatures, s.state, s.created_at, s.updated_at
  from public.card_game_session_state s
  where s.session_id = p_session_id;
end;
$$;

revoke execute on function public.card_game_is_session_participant(uuid) from public;
revoke execute on function public.card_game_is_session_host(uuid) from public;
revoke execute on function public.card_game_get_session_state(uuid) from public;
revoke execute on function public.card_game_set_selection(uuid, text[]) from public;
revoke execute on function public.card_game_set_state(uuid, jsonb) from public;

grant execute on function public.card_game_is_session_participant(uuid) to authenticated;
grant execute on function public.card_game_is_session_host(uuid) to authenticated;
grant execute on function public.card_game_get_session_state(uuid) to authenticated;
grant execute on function public.card_game_set_selection(uuid, text[]) to authenticated;
grant execute on function public.card_game_set_state(uuid, jsonb) to authenticated;
