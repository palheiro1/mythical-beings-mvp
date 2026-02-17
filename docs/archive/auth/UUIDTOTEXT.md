# Migration: Change User ID Columns from UUID to TEXT (Clerk-Compatible)

This checklist will guide you through migrating all user ID columns (e.g., `profiles.id`, `games.player1_id`, `games.player2_id`, etc.) from `uuid` to `text` in your Supabase/Postgres database, so you can use Clerk user IDs everywhere. **This is a breaking migration and must be done carefully.**

---

## Current State (as of 2025-05-13)
- ✅ Migration of user ID columns from `uuid` to `text` is complete.
- ✅ RLS policies and constraints have been recreated for `text` user IDs.
- ❗ However, users are still experiencing 400 errors when fetching profiles, and 401 errors on Edge Functions. This is because the `profiles` table does not have a row for every Clerk user ID that logs in.

### Explanation
- When a Clerk user logs in, your app expects a row in `profiles` with `id = <clerk_user_id>`. If this row does not exist, Supabase returns a 400 error for `.single()` queries, and RLS may block access.
- This is a common issue after such a migration, especially if you have not set up automatic profile creation for new users.

---

## New To-Do List: Ensure Profile Row Exists for Every Clerk User

### 1. Manual Fix (for local/dev/testing)
- [ ] For every Clerk user ID that appears in error logs (e.g., `user_2wrieISbCYUgLx9O88vSmYI6uQw`), manually insert a row into `profiles`:
  ```sql
  insert into profiles (id, username, avatar_url)
  values ('user_2wrieISbCYUgLx9O88vSmYI6uQw', 'Player2', null)
  on conflict (id) do nothing;
  ```
- [ ] Repeat for all missing Clerk user IDs.

### 2. Automatic Fix (recommended for production)
- [ ] Implement logic in your app to check for the existence of a `profiles` row after login, and create it if missing. Example:
  ```ts
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', clerkUserId)
    .single();
  if (error && error.code === 'PGRST116') {
    await supabase.from('profiles').insert({
      id: clerkUserId,
      username: 'New Player',
      avatar_url: null
    });
  }
  ```
- [ ] (Optional) Set up a Clerk webhook to create a profile row in Supabase whenever a new user signs up.

### 3. Test
- [ ] After inserting/migrating profiles, test the full flow: login, join game, profile fetch, and Edge Function calls.
- [ ] Confirm that no 400 errors occur for missing profiles.

---

## Summary
- The migration is complete, but every Clerk user must have a corresponding row in `profiles`.
- Add logic to auto-create profiles on login, or insert them manually for testing.
- Once this is done, the 400 errors should disappear and the app will work as intended.

---

## Previous Migration Checklist (for reference)

## 1. Preparation
- [ ] **Backup your database.**
- [ ] **List all tables and columns that store user IDs as UUID.**
    - Common: `profiles.id`, `games.player1_id`, `games.player2_id`, `moves.player_id`, etc.
- [ ] **List all RLS policies and foreign key constraints that reference these columns.**
- [ ] **List all indexes on these columns.**
- [ ] **List all triggers or functions that reference these columns (if any).**

## 2. Drop Policies and Constraints
- [ ] **Drop all RLS policies on affected tables.**
- [ ] **Drop all foreign key constraints referencing user ID columns.**
- [ ] **Drop all indexes on user ID columns (if needed).**

## 3. Alter Column Types
- [ ] **Alter each user ID column from `uuid` to `text`.**
    - Example:
      ```sql
      ALTER TABLE profiles ALTER COLUMN id TYPE text;
      ALTER TABLE games ALTER COLUMN player1_id TYPE text;
      ALTER TABLE games ALTER COLUMN player2_id TYPE text;
      ALTER TABLE moves ALTER COLUMN player_id TYPE text;
      -- Repeat for all relevant tables/columns
      ```

## 4. Data Migration (if needed)
- [ ] **If you have existing data, update the user ID values to Clerk user IDs.**
    - You may need a mapping table or script if you have existing users.
    - If this is a new project, you can skip this step.

## 5. Recreate Constraints and Indexes
- [ ] **Recreate foreign key constraints (now referencing `text` columns).**
    - Example:
      ```sql
      ALTER TABLE games ADD CONSTRAINT games_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES profiles(id);
      ALTER TABLE games ADD CONSTRAINT games_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES profiles(id);
      -- Repeat as needed
      ```
- [ ] **Recreate indexes on user ID columns if needed.**

## 6. Recreate RLS Policies
- [ ] **Recreate all RLS policies, now referencing `text` user IDs.**
    - Example:
      ```sql
      CREATE POLICY "Profiles Select" ON profiles
        FOR SELECT USING (id = auth.uid());
      CREATE POLICY "Games Select" ON games
        FOR SELECT USING (
          player1_id = auth.uid() OR player2_id = auth.uid()
        );
      -- Repeat for all policies
      ```

## 7. Test
- [ ] **Test all application flows (login, game creation, joining, profile fetch, etc.).**
- [ ] **Test RLS policies for all user actions.**
- [ ] **Test foreign key constraints and data integrity.**

## 8. Cleanup
- [ ] **Remove any temporary mapping tables or scripts used for migration.**
- [ ] **Document the migration for future reference.**

---

## Notes
- This migration will cause downtime for affected features. Plan accordingly.
- If you need to see your current policies, constraints, or table definitions, use the Supabase dashboard or ask your DBA.
- If you need help with any step, ask for the exact SQL or a script.

---

**Checklist completed by:** GitHub Copilot
**Date:** 2025-05-13
