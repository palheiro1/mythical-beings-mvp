-- Align games schema with app expectations and add triggers for consistency

-- 1) Rename column game_state -> state if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'game_state'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'state'
  ) THEN
    EXECUTE 'ALTER TABLE public.games RENAME COLUMN game_state TO state';
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- games table might not exist yet in some environments
  NULL;
END$$;

-- 2) Ensure required columns exist on public.games
DO $$
BEGIN
  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'status'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN status TEXT DEFAULT ''waiting''';
  END IF;

  -- Add bet_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'bet_amount'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN bet_amount NUMERIC DEFAULT 0';
  END IF;

  -- Add state JSONB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'state'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN state JSONB';
  END IF;

  -- Selection arrays and flags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player1_selected_creatures'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player1_selected_creatures TEXT[] DEFAULT ''{}''';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player2_selected_creatures'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player2_selected_creatures TEXT[] DEFAULT ''{}''';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player1_selection_complete'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player1_selection_complete BOOLEAN DEFAULT FALSE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player2_selection_complete'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player2_selection_complete BOOLEAN DEFAULT FALSE';
  END IF;

  -- Dealt hands
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player1_dealt_hand'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player1_dealt_hand TEXT[] DEFAULT ''{}''';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'player2_dealt_hand'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN player2_dealt_hand TEXT[] DEFAULT ''{}''';
  END IF;

  -- Ensure updated_at exists on games and profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.games ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()';
  END IF;
END$$;

-- 3) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_games_player1_id ON public.games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2_id ON public.games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_winner_id ON public.games(winner_id);

-- 4) Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS trg_set_updated_at_games ON public.games;
CREATE TRIGGER trg_set_updated_at_games
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_profiles ON public.profiles;
CREATE TRIGGER trg_set_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5) Sync selection completion flags between JSONB state and dedicated columns
CREATE OR REPLACE FUNCTION public.sync_selection_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  s jsonb;
BEGIN
  -- If state is null, nothing to sync
  IF NEW.state IS NULL THEN
    RETURN NEW;
  END IF;

  s := NEW.state;

  -- If JSONB state contains completion flags, propagate to columns
  IF s ? 'player1SelectionComplete' THEN
    NEW.player1_selection_complete := COALESCE((s->>'player1SelectionComplete')::boolean, NEW.player1_selection_complete);
  END IF;
  IF s ? 'player2SelectionComplete' THEN
    NEW.player2_selection_complete := COALESCE((s->>'player2SelectionComplete')::boolean, NEW.player2_selection_complete);
  END IF;

  -- Ensure JSONB state reflects column values (authoritative)
  s := jsonb_set(coalesce(s, '{}'::jsonb), '{player1SelectionComplete}', to_jsonb(COALESCE(NEW.player1_selection_complete, FALSE)), true);
  s := jsonb_set(s, '{player2SelectionComplete}', to_jsonb(COALESCE(NEW.player2_selection_complete, FALSE)), true);

  -- Ensure selected creatures arrays present in state
  IF NEW.player1_selected_creatures IS NOT NULL THEN
    s := jsonb_set(s, '{player1SelectedCreatures}', to_jsonb(NEW.player1_selected_creatures), true);
  END IF;
  IF NEW.player2_selected_creatures IS NOT NULL THEN
    s := jsonb_set(s, '{player2SelectedCreatures}', to_jsonb(NEW.player2_selected_creatures), true);
  END IF;

  NEW.state := s;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_selection_completion ON public.games;
CREATE TRIGGER trg_sync_selection_completion
BEFORE UPDATE OF state, player1_selected_creatures, player2_selected_creatures, player1_selection_complete, player2_selection_complete
ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.sync_selection_completion();
