-- Game expiry, leaderboard stats, and helper views

-- 1) Add earned_gem to profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'earned_gem'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ADD COLUMN earned_gem NUMERIC DEFAULT 0';
  END IF;
END$$;

-- 2) Create a helper view that hides expired waiting games (> 10 minutes)
DROP VIEW IF EXISTS public.available_active_games;
CREATE VIEW public.available_active_games AS
SELECT
  g.id,
  g.player1_id,
  g.player2_id,
  g.status,
  g.bet_amount,
  g.created_at,
  g.updated_at
FROM public.games g
WHERE
  (
    g.status = 'active'
  ) OR (
    g.status = 'waiting' AND g.created_at > now() - interval '10 minutes'
  );

COMMENT ON VIEW public.available_active_games IS 'Lists active games and non-expired waiting games (created within last 10 minutes).';

-- 3) BEFORE UPDATE trigger to auto-cancel expired waiting games when any update happens
CREATE OR REPLACE FUNCTION public.cancel_expired_waiting_game()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'waiting' AND OLD.created_at < now() - interval '10 minutes' THEN
    NEW.status := 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_expired_waiting_game ON public.games;
CREATE TRIGGER trg_cancel_expired_waiting_game
BEFORE UPDATE ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.cancel_expired_waiting_game();

-- 4) AFTER UPDATE trigger to update profile stats when a game is finished
CREATE OR REPLACE FUNCTION public.update_profiles_on_game_finish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when a game transitions to finished
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Increment games_played for both players if present
    IF NEW.player1_id IS NOT NULL THEN
      UPDATE public.profiles
      SET games_played = COALESCE(games_played, 0) + 1,
          updated_at = now()
      WHERE id = NEW.player1_id;
    END IF;

    IF NEW.player2_id IS NOT NULL THEN
      UPDATE public.profiles
      SET games_played = COALESCE(games_played, 0) + 1,
          updated_at = now()
      WHERE id = NEW.player2_id;
    END IF;

    -- Increment games_won and earned_gem for the winner, if provided
    IF NEW.winner_id IS NOT NULL THEN
      UPDATE public.profiles
      SET games_won = COALESCE(games_won, 0) + 1,
          earned_gem = COALESCE(earned_gem, 0) + COALESCE(NEW.bet_amount, 0),
          updated_at = now()
      WHERE id = NEW.winner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_profiles_on_game_finish ON public.games;
CREATE TRIGGER trg_update_profiles_on_game_finish
AFTER UPDATE OF status ON public.games
FOR EACH ROW
EXECUTE FUNCTION public.update_profiles_on_game_finish();
