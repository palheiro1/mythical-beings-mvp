# Supabase Database Schema for Mythical Beings MVP

This document outlines the ideal schema and Row Level Security (RLS) policies for the Supabase database, designed for integration with Clerk where Clerk provides a UUID as the `sub` claim in the JWT.

## 1. Ideal Table: `profiles`

Stores user-specific information.

| Column         | Type                        | Constraints                                    | Description                                                        |
|----------------|-----------------------------|------------------------------------------------|--------------------------------------------------------------------|
| `id`           | `uuid`                      | Primary Key, Not Null, References `auth.users.id` | User ID from Supabase `auth.users.id` (UUID from Clerk JWT `sub`). |
| `clerk_id`     | `text`                      | Unique, Not Null                               | User ID from Clerk (e.g., `user_xxx`). Stored for reference.       |
| `username`     | `text`                      | Unique, Nullable                               | Display name chosen by the user.                                   |
| `avatar_url`   | `text`                      | Nullable                                       | URL to the user's avatar image.                                   |
| `created_at`   | `timestamp with time zone`  | Not Null, `default now()`                      | Timestamp of profile creation.                                     |
| `updated_at`   | `timestamp with time zone`  | Not Null, `default now()`                      | Timestamp of the last profile update.                              |
| `games_played` | `integer`                   | Not Null, `default 0`                          | Total number of games the user has played.                         |
| `games_won`    | `integer`                   | Not Null, `default 0`                          | Total number of games the user has won.                            |
| `gems`         | `integer`                   | Not Null, `default 0`                          | In-game currency or points.                                        |

**RLS Policies for `profiles`:**

*   **Enable RLS:** Yes
*   **SELECT (Own Profile):** Users can select their own profile.
    *   `USING (auth.uid() = id)`
*   **SELECT (Public Info):** Authenticated users can select limited public information from other profiles (e.g., for leaderboards: `username`, `avatar_url`, `games_played`, `games_won`, `clerk_id`).
    *   `USING (auth.role() = 'authenticated')`
*   **UPDATE (Own Profile):** Users can update their own profile (e.g., `username`, `avatar_url`).
    *   `USING (auth.uid() = id)`
    *   `WITH CHECK (auth.uid() = id)`
*   **INSERT:** Handled by the `handle_new_user` trigger/function. Direct client-side inserts should be disallowed.

## 2. Ideal Table: `games`

Stores information about individual game matches.

| Column         | Type                        | Constraints                                    | Description                                                        |
|----------------|-----------------------------|------------------------------------------------|--------------------------------------------------------------------|
| `id`           | `uuid`                      | Primary Key, Not Null, `default gen_random_uuid()` | Unique identifier for the game.                                    |
| `created_at`   | `timestamp with time zone`  | Not Null, `default now()`                      | Timestamp of game creation.                                        |
| `updated_at`   | `timestamp with time zone`  | Not Null, `default now()`                      | Timestamp of the last game update.                                 |
| `player1_id`   | `uuid`                      | Not Null, Foreign Key to `profiles.id`         | ID of the first player (Supabase UUID).                            |
| `player2_id`   | `uuid`                      | Nullable, Foreign Key to `profiles.id`         | ID of the second player (Supabase UUID, null if waiting).          |
| `status`       | `public.game_status_enum`   | Not Null, `default 'waiting'`                  | Game status (e.g., 'waiting', 'selecting', 'active', 'finished', 'cancelled'). |
| `bet_amount`   | `integer`                   | Not Null, `default 0`                          | Amount of `gems` bet on this game.                                 |
| `state`        | `jsonb`                     | Nullable                                       | Stores the current `GameState` object.                             |
| `winner_id`    | `uuid`                      | Nullable, Foreign Key to `profiles.id`         | ID of the winning player (Supabase UUID, null if draw or ongoing). |

**RLS Policies for `games`:**

*   **Enable RLS:** Yes
*   **Enable Realtime:** Yes
*   **SELECT (Lobby/Active Games):** Authenticated users can see 'waiting' and 'active' games.
    *   `USING (auth.role() = 'authenticated' AND (status = 'waiting' OR status = 'active'))`
*   **SELECT (Own Games):** Players involved in a game can select their game details.
    *   `USING (auth.uid() = player1_id OR auth.uid() = player2_id)`
*   **INSERT:** Authenticated users can create new games.
    *   `WITH CHECK (auth.role() = 'authenticated' AND player1_id = auth.uid() AND status = 'waiting')`
*   **UPDATE (Join Game):** Authenticated users can join a 'waiting' game.
    *   `USING (auth.role() = 'authenticated' AND status = 'waiting' AND player2_id IS NULL)`
    *   `WITH CHECK (auth.uid() = player2_id AND player1_id <> player2_id)`
*   **UPDATE (Game State/Status by Players):** Players involved in an 'active' game can update its state or status.
    *   `USING (status = 'active' AND (auth.uid() = player1_id OR auth.uid() = player2_id))`
    *   `WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id)`

## 3. Ideal Table: `moves`

Logs player actions within a game.

| Column        | Type                        | Constraints                                    | Description                                                        |
|---------------|-----------------------------|------------------------------------------------|--------------------------------------------------------------------|
| `id`          | `bigint`                    | Primary Key, Generated always as identity      | Unique identifier for the move.                                    |
| `game_id`     | `uuid`                      | Not Null, Foreign Key to `games.id`            | ID of the game this move belongs to.                               |
| `player_id`   | `uuid`                      | Not Null, Foreign Key to `profiles.id`         | ID of the player who made the move (Supabase UUID).                |
| `action_type` | `text`                      | Not Null                                       | Type of action performed.                                          |
| `payload`     | `jsonb`                     | Nullable                                       | Data associated with the action.                                   |
| `timestamp`   | `timestamp with time zone`  | Not Null, `default now()`                      | Timestamp of when the move was made.                               |

**RLS Policies for `moves`:**

*   **Enable RLS:** Yes
*   **SELECT:** Players involved in a game can see the moves for that game.
    *   `USING (EXISTS (SELECT 1 FROM games WHERE games.id = moves.game_id AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())))`
*   **INSERT:** Players involved in an active game can log their moves.
    *   `WITH CHECK (player_id = auth.uid() AND EXISTS (SELECT 1 FROM games WHERE games.id = moves.game_id AND games.status = 'active' AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())))`

## 4. Ideal Supabase Storage: `avatars`

Bucket for storing user avatar images. Folder structure: `{user_id_uuid}/{filename}`. (Note: `user_id_uuid` refers to `profiles.id` which is a UUID)

**RLS Policies for Storage `avatars` bucket:**

*   **SELECT (Public Read):** Allow public read access if avatars are generally public.
    *   `FOR SELECT USING (bucket_id = 'avatars')` (Apply to `public` role)
*   **INSERT (Own Avatar):** Users can insert into their own folder (folder name should be their UUID `profiles.id`).
    *   `FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])`  -- This might need adjustment if `auth.uid()` is directly UUID. The folder name should be the UUID.
    *   Consider: `FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid)` -- if folder names are UUIDs.
*   **UPDATE (Own Avatar):** Users can update files in their own folder.
    *   `FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])`
    *   Consider: `FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid)`
*   **DELETE (Own Avatar):** Users can delete files from their own folder.
    *   `FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])`
    *   Consider: `FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid)`

---

### Phase 5: Storage RLS Policies [✅]

**Status:** [✅] Applied

**Details:**
The `avatars` storage bucket will store user profile pictures.
- Files will be stored in folders named after the user's `auth.users.id` (UUID).
- Example path: `avatars/uuid_of_user/avatar.png`

**RLS Policies for `storage.objects` (bucket_id = 'avatars'):**

1.  **Public Read Access:** Anyone can read avatar files.
    ```sql
    CREATE POLICY "Public read access for avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
    ```
2.  **Authenticated Insert Own Avatar:** Authenticated users can upload their own avatar into a folder named with their UUID.
    ```sql
    CREATE POLICY "Allow own avatar insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid);
    ```
3.  **Authenticated Update Own Avatar:** Authenticated users can update their own avatar.
    ```sql
    CREATE POLICY "Allow own avatar update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid);
    ```
4.  **Authenticated Delete Own Avatar:** Authenticated users can delete their own avatar.
    ```sql
    CREATE POLICY "Allow own avatar delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'avatars' AND auth.uid() = ((storage.foldername(name))[1])::uuid);
    ```

**Applied via migration:** `apply_avatars_storage_rls_policies_v2`

---

## To-Do List & Migration Plan:

**Phase 1: Clerk JWT & Supabase Auth Setup [✅]**
- [✅] Configure Clerk JWT template for Supabase.
  - [✅] `sub` claim maps to `auth.users.id` (Supabase UUID).
  - [✅] `iss` claim is `https://your-clerk-domain`.
  - [✅] Custom claims: `clerk_id` (Clerk's `user_...` ID), `email`, `username`, `avatar_url`.
  - [✅] Use Supabase JWT Signing Secret from Project Settings > API.

**Phase 2: Core Table Schema Migration (UUIDs) [✅]**
- [✅] **`profiles` table:**
  - [✅] `id` (UUID, Primary Key, references `auth.users.id` ON DELETE CASCADE).
  - [✅] `clerk_id` (TEXT, UNIQUE, NOT NULL).
  - [✅] `username` (TEXT, UNIQUE, NOT NULL).
  - [✅] `email` (TEXT, UNIQUE, NOT NULL).
  - [✅] `avatar_url` (TEXT).
  - [✅] `gems` (INTEGER, DEFAULT 0, NOT NULL).
  - [✅] `created_at` (TIMESTAMPTZ, DEFAULT `now()`, NOT NULL).
  - [✅] `updated_at` (TIMESTAMPTZ, DEFAULT `now()`, NOT NULL).
- [✅] **`games` table:**
  - [✅] `id` (UUID, Primary Key, DEFAULT `gen_random_uuid()`).
  - [✅] `player1_id` (UUID, Foreign Key to `profiles.id` ON DELETE SET NULL).
  - [✅] `player2_id` (UUID, Foreign Key to `profiles.id` ON DELETE SET NULL).
  - [✅] `winner_id` (UUID, Foreign Key to `profiles.id` ON DELETE SET NULL, nullable).
  - [✅] `status` (`game_status_enum` - e.g., 'pending', 'active', 'completed', 'expired', 'cancelled', DEFAULT 'pending', NOT NULL).
  - [✅] `state` (JSONB, stores game state like cards, scores, turn).
  - [✅] `created_at` (TIMESTAMPTZ, DEFAULT `now()`, NOT NULL).
  - [✅] `updated_at` (TIMESTAMPTZ, DEFAULT `now()`, NOT NULL).
  - [✅] `expires_at` (TIMESTAMPTZ, e.g., `now() + interval '24 hours'`).
- [✅] **`moves` table:**
  - [✅] `id` (BIGINT, Primary Key, GENERATED ALWAYS AS IDENTITY).
  - [✅] `game_id` (UUID, Foreign Key to `games.id` ON DELETE CASCADE, NOT NULL).
  - [✅] `player_id` (UUID, Foreign Key to `profiles.id` ON DELETE CASCADE, NOT NULL).
  - [✅] `move_data` (JSONB, details of the move).
  - [✅] `move_number` (INTEGER, NOT NULL).
  - [✅] `created_at` (TIMESTAMPTZ, DEFAULT `now()`, NOT NULL).

**Phase 3: Functions and Triggers [✅]**
- [✅] `public.handle_new_user()` trigger function:
  - [✅] Populates `profiles` table on new `auth.users` entry.
  - [✅] Maps `auth.users.id` to `profiles.id`.
  - [✅] Pulls `clerk_id`, `email`, `username`, `avatar_url` from JWT's `raw_user_meta_data`.
  - [✅] Sets `profiles.clerk_id` to NOT NULL.
- [✅] `on_auth_user_created` trigger on `auth.users` table.
- [✅] `public.update_updated_at_column()` trigger function.
- [✅] Triggers on `profiles` and `games` for `updated_at`.

**Phase 4: Row Level Security (RLS) Policies [✅]**
- [✅] **`profiles` table:**
  - [✅] Enable RLS.
  - [✅] Allow public read access.
  - [✅] Allow users to update their own profile (`id = auth.uid()`).
  - [✅] (No delete policy for users on their own profiles for now, can be admin/server-side).
- [✅] **`games` table:**
  - [✅] Enable RLS.
  - [✅] Allow authenticated users to create new games.
  - [✅] Allow players involved (`player1_id = auth.uid()` OR `player2_id = auth.uid()`) or public to read game info.
  - [✅] Allow players involved to update game (e.g., change status, make moves if game logic allows).
  - [✅] (No specific delete policy for users, maybe admin/server-side or by status update).
- [✅] **`moves` table:**
  - [✅] Enable RLS.
  - [✅] Allow players involved in the game to insert moves for themselves (`player_id = auth.uid()`).
  - [✅] Allow players involved in the game or public to read moves.
  - [✅] (No update/delete on moves to maintain game history integrity).

**Phase 5: Storage RLS Policies [✅]**
- [✅] **`avatars` bucket:**
  - [✅] Public read access.
  - [✅] Authenticated users can insert/update/delete their own avatar (folder name must be user's UUID).

**Phase 6: Data Migration/Verification**
- [ ] Ensure `profiles.clerk_id` is populated correctly by the `handle_new_user` trigger upon new user creation. (Test by signing up a new user).
- [ ] Verify `usePlayerIdentification` hook now correctly provides the Supabase UUID.

**Phase 7: Testing and Refinement**
- [ ] Thorough testing of authentication flow (Clerk -> Supabase).
- [ ] Test profile creation and updates.
- [ ] Test game creation, lifecycle (active, completed, etc.), and moves.
- [ ] Verify RLS policies for all tables (try accessing/modifying data as different users).
- [ ] Verify Storage RLS policies (upload, view, update, delete avatar).
- [ ] Test realtime features if implemented (e.g., game updates).
- [ ] **Frontend Updates:**
    - [ ] Regenerate Supabase TypeScript types:
      ```bash
      npx supabase gen types typescript --project-id layijhifboyouicxsunq --schema public > src/types/supabase.ts
      ```
    - [ ] Update frontend code to use/expect UUIDs for user identifiers.
    - [ ] Update frontend code to align with any other schema changes (e.g., `games.state` JSONB).
- [ ] Schedule `expire_old_games` function using `pg_cron` (manual step in Supabase Dashboard, if still desired).
    ```sql
    -- Example: Run daily at midnight UTC to expire games older than 7 days and still 'active' or 'pending'
    -- SELECT cron.schedule('expire-old-games-daily', '0 0 * * *', $$
    --   UPDATE games
    --   SET status = 'expired', updated_at = now()
    --   WHERE expires_at < now() AND (status = 'active' OR status = 'pending');
    -- $$);
    -- Make sure the cron job has permissions to update the table.
    -- GRANT UPDATE ON games TO postgres; -- Or the user pg_cron runs as
    ```

**Phase 8: Documentation & Cleanup**
- [ ] Update any external documentation or READMEs.
- [ ] Review and remove any temporary migration SQL files or notes if not needed.
- [ ] Final check of `DATABASE.md` for accuracy and completeness.

---
