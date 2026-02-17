# Database (Supabase)

This project uses Supabase Postgres + Realtime for multiplayer state synchronization.

## Tables (High Level)

- `profiles`
  - Holds player profile data.
  - The primary key `id` is the **Supabase Auth user id**.
  - Wallet address is stored separately (for example `eth_address`) and may be synced by the auth Edge Function.

- `apps`
  - Registry of games/apps in the Play Hub (used to partition data by app).

- `games`
  - Multiplayer game records (lobby + selection + running match).
  - Stores player ids (`player1_id`, `player2_id`), selection fields, status, and a serialized `state` blob.
  - `app_id` links a game instance to an app in `apps` (nullable for backwards compatibility).

- `moves`
  - Optional append-only move log referencing `games.id`.

- `channels`, `channel_members`, `messages`
  - Chat support (global, game-scoped, or DM channels).

- `leaderboards`, `leaderboard_entries`
  - Public-read, server-write leaderboard data.

## Policies / RLS

RLS policies are required so only game participants can read/write a game.

See:
- `update-schema.sql` (helper `is_same_user` and updated `games` policies)
- `update-rls-policies.sh` (deployment helper; reads service role key from `.env.local`)

## Edge Functions

- `supabase/functions/moralis-auth`
  - Verifies MetaMask signatures and issues Supabase JWTs.
  - Ensures a profile exists via RPC (for example `ensure_user_profile_exists`).
- `supabase/functions/simplified-moralis-auth`
  - Fallback auth path.
- `supabase/functions/create-game`
- `supabase/functions/deal-cards`

## Type Generation

`src/types/supabase.ts` is a snapshot of the schema and may drift if migrations are applied without regenerating types.
