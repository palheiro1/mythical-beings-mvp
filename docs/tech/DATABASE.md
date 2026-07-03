# Database (Supabase)

This project uses Supabase Postgres + Realtime for multiplayer state synchronization.

## Tables (High Level)

- `profiles`
  - Holds player profile data.
  - The primary key `id` is the **Supabase Auth user id**.
  - Play Hub profile operations are routed through `@mythicalb/sdk`.
  - Polygon wallet linking is handled by Play Hub wallet APIs, not by a local auth Edge Function.

- `game_sessions`, `session_participants`
  - Play Hub multiplayer lobby/session records.
  - Wisdom Duel uses `game_id='card_game'`, `mode_id='casual'` and `mode_id='competitive_gem'`.

- `card_game_session_state`
  - Stores dealt hands, selected creatures, and the serialized running `GameState`.

- `card_game_competitions`, `card_game_competition_deposits`
  - Competitive GEM metadata, stake/deposit status, escrow tx hashes, and settlement state.

- `profile_wallets`, `profile_wallet_challenges`
  - Linked Ardor/Polygon wallets and wallet-link challenges managed by Play Hub.

- `mythical_assets`
  - Shared asset catalog. Competitive card dealing reads Polygon ERC-1155 card metadata from this table.

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

- `supabase/functions/deal-cards`
  - Deals the initial card hands after a Play Hub session starts.
  - Casual mode deals random hands.
  - Competitive GEM mode checks Polygon ERC-1155 ownership through `POLYGON_RPC_URL`.

Play Hub SDK functions are maintained in the `mythicalSDK` repo:

- `playhub-wallet-challenge`
- `playhub-link-wallet`
- `playhub-unlink-wallet`
- `card-game-create-competition-session`
- `card-game-join-competition-session`
- `card-game-competition-status`
- `card-game-verify-deposit`
- `card-game-settlement-signature`

## Type Generation

`src/types/supabase.ts` is a snapshot of the schema and may drift if migrations are applied without regenerating types.
