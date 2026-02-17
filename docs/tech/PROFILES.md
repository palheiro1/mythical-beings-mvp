# User Profiles Implementation Plan

This document outlines the steps to implement user profiles with names and avatars in the Mythical Beings game, replacing the current mock player identification.

## Phase 1: Backend Setup (Supabase) - ✅ COMPLETED (Manual Steps)

1.  **✅ Enable Supabase Auth:**
    *   In the Supabase dashboard, go to Authentication -> Providers.
    *   Enable at least one provider (e.g., Email). Configure settings as needed (e.g., disable email confirmation for easier testing initially).
    *   Go to Authentication -> Settings and note the JWT secret (needed for RLS later if desired).

2.  **✅ Create `profiles` Table:**
    *   Go to Table Editor -> New Table.
    *   Name: `profiles`
    *   Columns:
        *   `id` (Type: `uuid`, Primary Key, Default: `gen_random_uuid()`, Is Identity: `true`, **Link to `auth.users.id`**: Set as Foreign Key referencing `auth.users` `id`)
        *   `username` (Type: `text`, Unique: `true`, Allow Nullable: `false`)
        *   `avatar_url` (Type: `text`, Allow Nullable: `true`)
        *   `updated_at` (Type: `timestamp with time zone`, Default: `now()`)
    *   Enable Row Level Security (RLS) if desired for finer control, otherwise leave disabled for now.
    *   *Initial RLS Policies (Example - adapt as needed):*
        *   Allow authenticated users to read their own profile.
        *   Allow authenticated users to update their own profile.
        *   Allow authenticated users to read other profiles (for displaying opponent info).

3.  **✅ Create Supabase Storage Bucket for Avatars:**
    *   Go to Storage -> Create Bucket.
    *   Name: `avatars`
    *   Access: Public (for easy display) or configure RLS policies for access control.
    *   *RLS Policies (Example if not public):*
        *   Allow authenticated users to upload to their own folder (`{user_id}/*`).
        *   Allow anyone to read files (if bucket is not public).

4.  **✅ Create Database Function for New User Profile:**
    *   Go to Database -> Functions -> Create Function.
    *   Name: `handle_new_user`
    *   Schema: `public`
    *   Return Type: `trigger`
    *   Code:
        ```sql
        -- inserts a row into public.profiles
        create function public.handle_new_user()
        returns trigger
        language plpgsql
        security definer set search_path = public
        as $$
        begin
          insert into public.profiles (id, username)
          values (new.id, new.email); -- Use email as initial username, or generate one
          return new;
        end;
        $$;

        -- trigger the function every time a user is created
        create trigger on_auth_user_created
          after insert on auth.users
          for each row execute procedure public.handle_new_user();
        ```
    *   This function automatically creates a profile entry when a new user signs up in Supabase Auth.

## Phase 2: Frontend Implementation

1.  **✅ Install Supabase Auth UI (Optional but Recommended):**
    *   `npm install @supabase/auth-ui-react @supabase/auth-ui-shared` (Completed, with warnings)

2.  **✅ Authentication Context/Hook:**
    *   Create a context (`src/context/AuthContext.tsx`) or a hook (`src/hooks/useAuth.ts`) to manage the user's session state (user object, loading state, login/logout functions).
    *   Use `supabase.auth.onAuthStateChange` to listen for login/logout events and update the context/hook state.
    *   Wrap the `App` component with the Auth provider.

3.  **✅ Modify `usePlayerIdentification.ts`:**
    *   Remove the URL parameter logic.
    *   Use the Auth context/hook to get the current authenticated user's ID (`session.user.id`).
    *   Return this ID. Handle cases where the user is not logged in.

4.  **✅ Create Profile Page (`src/pages/Profile.tsx`):**
    *   Route: Add `/profile` route in `App.tsx`.
    *   Functionality:
        *   Fetch the current user's profile data from the `profiles` table using their ID.
        *   Display current username and avatar.
        *   Allow updating the username.
        *   Implement avatar upload:
            *   Use an `<input type="file">`.
            *   On file selection, upload the image to the `avatars` bucket in Supabase Storage (e.g., path: `{user_id}/{timestamp}-{filename}`).
            *   On successful upload, get the public URL (or signed URL if using RLS).
            *   Update the `avatar_url` column in the user's `profiles` row.

5.  **✅ Update Supabase Utility Functions (`src/utils/supabase.ts`):**
    *   Add functions:
        *   `getProfile(userId: string)`: Fetches a profile by user ID.
        *   `updateProfile(userId: string, updates: { username?: string; avatar_url?: string })`: Updates profile data.
        *   `uploadAvatar(userId: string, file: File)`: Handles avatar upload logic.

6.  **✅ Integrate Profile Data in UI:**
    *   **`GameScreen.tsx`:**
        *   Fetch profiles for both `player1_id` and `player2_id` from the `games` table record.
        *   Pass usernames and avatar URLs to `TopBar` or display them directly near player areas.
    *   **`Lobby.tsx`:**
        *   Fetch the profile for `player1_id` for each listed game.
        *   Display the username instead of just the ID.
    *   **`TopBar.tsx` / Other Components:** Modify components to accept and display username/avatar props.

7.  **Login/Logout UI:**
    *   Add Login/Signup forms (using Supabase Auth UI or custom forms) accessible from `Home.tsx` or a dedicated auth page.
    *   Add a Logout button (e.g., in a header or on the profile page) that calls `supabase.auth.signOut()`.
    *   Protect routes (Lobby, GameScreen, Profile) so they require authentication.

## Phase 3: Refinements

1.  **Error Handling:** Improve error handling for profile fetching, updates, and uploads.
2.  **Loading States:** Add loading indicators while fetching profile data or uploading avatars.
3.  **Username Validation:** Add validation for usernames (e.g., length, allowed characters, check uniqueness if not handled by DB constraint alone).
4.  **Avatar Styling:** Style the avatar display (size, shape, placeholders).
5.  **RLS Policies:** Review and tighten RLS policies for `profiles` and `avatars` storage if needed.
