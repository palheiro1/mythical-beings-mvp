-- Play Hub core schema (multi-game)
-- This extends the existing Card Game schema to support multiple Mythical Beings games
-- in a shared Supabase project (users, chat, leaderboards, app partitioning).

-- Extensions (Supabase usually enables these, but be explicit)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Apps (game/app registry)
CREATE TABLE IF NOT EXISTS public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- Readable by all authenticated/anon clients (public registry)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'apps' AND policyname = 'Apps are readable'
  ) THEN
    EXECUTE 'CREATE POLICY "Apps are readable" ON public.apps FOR SELECT USING (true)';
  END IF;
END$$;

-- Seed at least one known app slug for this repository
INSERT INTO public.apps (slug, name)
VALUES ('card-game', 'Mythical Beings Card Game')
ON CONFLICT (slug) DO NOTHING;

-- Attach updated_at trigger if helper exists (created in earlier migrations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)) THEN
    DROP TRIGGER IF EXISTS trg_set_updated_at_apps ON public.apps;
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_apps BEFORE UPDATE ON public.apps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END$$;

-- 2) Partition games by app (nullable for backward compatibility)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'games'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'app_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.games ADD COLUMN app_id UUID REFERENCES public.apps(id)';
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_games_app_id ON public.games(app_id);

-- Keep the helper view but include app_id
DROP VIEW IF EXISTS public.available_active_games;
CREATE VIEW public.available_active_games AS
SELECT
  g.id,
  g.app_id,
  g.player1_id,
  g.player2_id,
  g.status,
  g.bet_amount,
  g.created_at,
  g.updated_at
FROM public.games g
WHERE
  (g.status = 'active')
  OR (g.status = 'waiting' AND g.created_at > now() - interval '10 minutes');

COMMENT ON VIEW public.available_active_games IS 'Lists active games and non-expired waiting games (created within last 10 minutes).';

-- 3) Chat (channels + members + messages)
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  app_id UUID REFERENCES public.apps(id),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  is_public BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT channels_scope_check CHECK (scope IN ('global', 'game', 'dm')),
  CONSTRAINT channels_scope_game_check CHECK (
    (scope = 'game' AND game_id IS NOT NULL) OR
    (scope <> 'game' AND game_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_channels_app_id ON public.channels(app_id);
CREATE INDEX IF NOT EXISTS idx_channels_game_id ON public.channels(game_id);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id_created_at ON public.messages(channel_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: game participant check
CREATE OR REPLACE FUNCTION public.is_game_participant(p_game_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = p_game_id
      AND (g.player1_id = auth.uid() OR g.player2_id = auth.uid())
  );
$$;

-- Channels policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channels' AND policyname = 'Channels are readable'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Channels are readable" ON public.channels
      FOR SELECT
      USING (
        is_public
        OR EXISTS (
          SELECT 1 FROM public.channel_members m
          WHERE m.channel_id = channels.id AND m.user_id = auth.uid()
        )
        OR (scope = 'game' AND public.is_game_participant(game_id))
      )
    $POL$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channels' AND policyname = 'Channels are creatable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "Channels are creatable by owner" ON public.channels FOR INSERT WITH CHECK (auth.uid() = created_by)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channels' AND policyname = 'Channels are updatable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "Channels are updatable by owner" ON public.channels FOR UPDATE USING (auth.uid() = created_by)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channels' AND policyname = 'Channels are deletable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "Channels are deletable by owner" ON public.channels FOR DELETE USING (auth.uid() = created_by)';
  END IF;
END$$;

-- Channel members policies (only channel creator manages membership; members can see themselves)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channel_members' AND policyname = 'Channel members self readable'
  ) THEN
    EXECUTE 'CREATE POLICY "Channel members self readable" ON public.channel_members FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'channel_members' AND policyname = 'Channel members manageable by channel owner'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Channel members manageable by channel owner" ON public.channel_members
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.channels c
          WHERE c.id = channel_members.channel_id AND c.created_by = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.channels c
          WHERE c.id = channel_members.channel_id AND c.created_by = auth.uid()
        )
      )
    $POL$;
  END IF;
END$$;

-- Messages policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Messages are readable'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Messages are readable" ON public.messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.channels c
          WHERE c.id = messages.channel_id AND (
            c.is_public
            OR EXISTS (
              SELECT 1 FROM public.channel_members m
              WHERE m.channel_id = c.id AND m.user_id = auth.uid()
            )
            OR (c.scope = 'game' AND public.is_game_participant(c.game_id))
          )
        )
      )
    $POL$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Messages are creatable by author'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Messages are creatable by author" ON public.messages
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.channels c
          WHERE c.id = messages.channel_id AND (
            c.is_public
            OR EXISTS (
              SELECT 1 FROM public.channel_members m
              WHERE m.channel_id = c.id AND m.user_id = auth.uid()
            )
            OR (c.scope = 'game' AND public.is_game_participant(c.game_id))
          )
        )
      )
    $POL$;
  END IF;
END$$;

-- Attach updated_at trigger for channels if helper exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)) THEN
    DROP TRIGGER IF EXISTS trg_set_updated_at_channels ON public.channels;
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_channels BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END$$;

-- 4) Leaderboards (server-write, public-read)
CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES public.apps(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, slug)
);

ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leaderboards' AND policyname = 'Leaderboards are readable'
  ) THEN
    EXECUTE 'CREATE POLICY "Leaderboards are readable" ON public.leaderboards FOR SELECT USING (true)';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  score BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (leaderboard_id, user_id)
);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'leaderboard_entries' AND policyname = 'Leaderboard entries are readable'
  ) THEN
    EXECUTE 'CREATE POLICY "Leaderboard entries are readable" ON public.leaderboard_entries FOR SELECT USING (true)';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pg_function_is_visible(oid)) THEN
    DROP TRIGGER IF EXISTS trg_set_updated_at_leaderboards ON public.leaderboards;
    EXECUTE 'CREATE TRIGGER trg_set_updated_at_leaderboards BEFORE UPDATE ON public.leaderboards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END$$;

-- 5) Tighten ensure_user_profile_exists: server-side only
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
  v_profile record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  v_final_username := 'Player_' || substring(p_evm_address, 3, 6);

  INSERT INTO public.profiles (id, username, eth_address, created_at, updated_at)
  VALUES (p_user_id, v_final_username, lower(p_evm_address), now(), now())
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    eth_address = EXCLUDED.eth_address,
    updated_at = now()
  RETURNING * INTO v_profile;

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

REVOKE EXECUTE ON FUNCTION public.ensure_user_profile_exists(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile_exists(TEXT, UUID) TO service_role;
