<!-- filepath: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/METAMASK.md -->
# Integrating Clerk with Metamask and Supabase

This checklist outlines the steps to integrate Clerk (using Metamask) as an additional authentication method alongside the existing Supabase email/password authentication.

## Phase 1: Backend Configuration (Clerk & Supabase Setup)

- [x] **1.1. Set up Clerk Application:**
    - [x] Ensure you have a Clerk application set up. (Reference: [Clerk Quickstart](https://clerk.com/docs/quickstarts/setup-clerk))
    - [x] Configure Metamask as an allowed sign-in method within your Clerk application settings if not already done.

- [x] **1.2. Configure Clerk as a Supabase Third-Party Auth Provider:**
    - [x] In the Clerk Dashboard, navigate to the Supabase integration setup page (usually under "Integrations" or a similar section).
    - [x] Select your configuration options and activate the Supabase integration. This enables Clerk's standard session tokens to be used with Supabase.
    - [x] Copy the "Clerk domain" (Issuer URL) provided by Clerk.
    - [x] In the Supabase Dashboard, go to "Authentication" -> "Providers" (or "Sign In / Up" -> "Third-party providers").
    - [x] Click "Add provider" and select "Clerk" (or "OpenID Connect" / "JWT" if Clerk isn't listed directly, and configure manually using the Clerk domain as the Issuer URL).
    - [x] Paste the copied Clerk domain into the appropriate field (e.g., "Issuer URL").
    - [x] Save the provider configuration in Supabase.

- [x] **1.3. Set up Row Level Security (RLS) Policies in Supabase (Important for Data Security):**
    - [x] **Identify tables needing user-specific access:** Identified tables: `profiles`, `games`, `moves`. These tables store or reference user-specific data.
    - [x] **Clarification on user ID column:** Supabase, when integrated with Clerk as a third-party OIDC provider, will use the Clerk user ID (from the JWT `sub` claim) as the value for `auth.uid()`. Therefore, existing columns that store user identifiers (e.g., `profiles.id`, `games.player1_id`, `games.player2_id`, `moves.player_id`) will be used. These columns are confirmed to be of type `text` (or `string` in TypeScript types), suitable for storing Clerk user IDs. The RLS policies will compare these columns against `auth.uid()` (or equivalently, `(select auth.jwt()->>'sub')`). No *new, separate* `user_id` column specifically for the Clerk ID is needed in these tables.
        ```sql
        -- For new tables (if created outside existing schema that need user ownership),
        -- a common pattern is:
        -- create table your_new_table_name (
        --   id serial primary key,
        --   -- other columns...
        --   user_id text not null default auth.uid() -- Automatically populates with the authenticated user's ID (Clerk ID in this setup)
        -- );
        ```
    - [x] **Enable RLS on these tables:**
        ```sql
        -- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; -- Done
        -- ALTER TABLE games ENABLE ROW LEVEL SECURITY; -- Done
        -- ALTER TABLE moves ENABLE ROW LEVEL SECURITY; -- Done
        ```
    - [ ] **Create RLS policies:** Define policies to restrict access based on the user identifier matching `auth.uid()` (which is the Clerk `sub` claim, cast to `text` for comparison with `text` columns).
        - **Policies for `profiles` table:**
            - **Note:** We are currently facing a persistent `ERROR: 42883: operator does not exist: uuid = text` when attempting to apply or modify policies on the `profiles` table. This occurs even when trying to `DROP` existing policies or when using `auth.uid()::text` or `(SELECT auth.jwt()->>'sub')` in the policy definition. Further investigation is needed to resolve this database-level issue before these policies can be successfully applied.
            - *SELECT:*
              ```sql
              CREATE POLICY "Users can view their own profile"
              ON public.profiles
              FOR SELECT
              TO authenticated
              USING ((id = (SELECT auth.jwt()->>'sub')));
              ```
            - *INSERT:*
              ```sql
              CREATE POLICY "Users can create their own profile"
              ON public.profiles
              FOR INSERT
              TO authenticated
              WITH CHECK ((id = (SELECT auth.jwt()->>'sub')));
              ```
            - *UPDATE:*
              ```sql
              CREATE POLICY "Users can update their own profile"
              ON public.profiles
              FOR UPDATE
              TO authenticated
              USING ((id = (SELECT auth.jwt()->>'sub')))
              WITH CHECK ((id = (SELECT auth.jwt()->>'sub')));
              ```
        - **Policies for `games` table:**
            - *SELECT:*
              ```sql
              CREATE POLICY "Users can view their own games or open games"
              ON public.games
              FOR SELECT
              TO authenticated
              USING (
                (auth.uid()::text = player1_id) OR
                (auth.uid()::text = player2_id) OR
                (status = 'waiting' AND player2_id IS NULL)
              );
              ```
            - *INSERT:*
              ```sql
              CREATE POLICY "Users can create games"
              ON public.games
              FOR INSERT
              TO authenticated
              WITH CHECK (
                (auth.uid()::text = player1_id)
              );
              ```
            - *UPDATE:*
              ```sql
              CREATE POLICY "Users can update their games"
              ON public.games
              FOR UPDATE
              TO authenticated
              USING (
                (auth.uid()::text = player1_id) OR (auth.uid()::text = player2_id)
              )
              WITH CHECK (
                (auth.uid()::text = player1_id) OR (auth.uid()::text = player2_id)
              );
              ```
        - **Policies for `moves` table:**
            - *SELECT:*
              ```sql
              CREATE POLICY "Users can view moves in their games"
              ON public.moves
              FOR SELECT
              TO authenticated
              USING (
                EXISTS (
                  SELECT 1
                  FROM games g
                  WHERE g.id = moves.game_id
                  AND (g.player1_id = auth.uid()::text OR g.player2_id = auth.uid()::text)
                )
              );
              ```
            - *INSERT:*
              ```sql
              CREATE POLICY "Users can make moves in their games"
              ON public.moves
              FOR INSERT
              TO authenticated
              WITH CHECK (
                (auth.uid()::text = player_id) AND
                EXISTS (
                  SELECT 1
                  FROM games g
                  WHERE g.id = moves.game_id
                  AND (g.player1_id = auth.uid()::text OR g.player2_id = auth.uid()::text)
                  AND g.status = 'active' -- Adjust status as per game logic
                )
              );
              ```
            - *UPDATE (Consider if needed):*
              ```sql
              CREATE POLICY "Users can update their own moves (if applicable)"
              ON public.moves
              FOR UPDATE
              TO authenticated
              USING (
                (auth.uid()::text = player_id)
              )
              WITH CHECK (
                (auth.uid()::text = player_id) AND
                EXISTS (
                  SELECT 1
                  FROM games g
                  WHERE g.id = moves.game_id
                  AND (g.player1_id = auth.uid()::text OR g.player2_id = auth.uid()::text)
                )
              );
              ```
            - *DELETE (Consider if needed):*
              ```sql
              CREATE POLICY "Users can delete their own moves (if applicable)"
              ON public.moves
              FOR DELETE
              TO authenticated
              USING (
                (auth.uid()::text = player_id) AND
                EXISTS (
                  SELECT 1
                  FROM games g
                  WHERE g.id = moves.game_id
                  AND (g.player1_id = auth.uid()::text OR g.player2_id = auth.uid()::text)
                )
              );
              ```
    - [ ] **Apply to all relevant tables:** Review and apply the defined RLS policies for `profiles`, `games`, and `moves` using the Supabase SQL Editor. Mark this task as complete once all policies are successfully created. (Blocked by `profiles` table issue).

## Phase 2: Frontend Integration (UI & Client-Side Logic)

- [x] **2.1. Install/Update Necessary SDKs:**
    - [x] Ensure you have the latest Clerk SDK for your frontend framework (e.g., `@clerk/clerk-react` for React).
        ```bash
        # npm install @clerk/clerk-react
        # yarn add @clerk/clerk-react
        # pnpm add @clerk/clerk-react
        ```
    - [x] Ensure you have the Supabase client library (`@supabase/supabase-js`).
        ```bash
        # npm install @supabase/supabase-js
        # yarn add @supabase/supabase-js
        # pnpm add @supabase/supabase-js
        ```

- [x] **2.2. Set up Environment Variables:**
    - [x] Add your Clerk Frontend API key to your environment variables (e.g., `VITE_CLERK_PUBLISHABLE_KEY` for Vite).
    - [x] Ensure your Supabase URL and Anon Key are in your environment variables (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

- [x] **2.3. Initialize Clerk Provider:**
    - [x] Wrap your application (or relevant parts) with the ClerkProvider, configured with your Publishable Key.
        ```tsx
        // Example for React (e.g., in main.tsx or App.tsx)
        // import { ClerkProvider } from '@clerk/clerk-react';
        //
        // const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
        //
        // if (!PUBLISHABLE_KEY) {
        //   throw new Error("Missing Publishable Key");
        // }
        //
        // ReactDOM.createRoot(document.getElementById('root')!).render(
        //   <React.StrictMode>
        //     <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        //       <App />
        //     </ClerkProvider>
        //   </React.StrictMode>,
        // );
        ```

- [x] **2.4. Update Supabase Client Initialization for Clerk:**
    - [x] Modify your Supabase client initialization to use the Clerk session token.
    - [x] The `createClerkSupabaseClient()` helper from Clerk is the recommended way for client-side Supabase client creation.
        ```typescript
        // In your supabase.ts or a similar utility file
        // import { createClient } from '@supabase/supabase-js';
        // // No direct Clerk imports needed here for token if using window.Clerk
        //
        // const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        // const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        //
        // const getToken = async () => {
        //   // @ts-expect-error Clerk is attached to window
        //   if (typeof window !== 'undefined' && window.Clerk && window.Clerk.session) {
        //     // @ts-expect-error Clerk is attached to window
        //     const token = await window.Clerk.session.getToken(); // Use standard Clerk session token
        //     return token;
        //   }
        //   return null;
        // };
        //
        // export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        //   global: {
        //     fetch: async (input, init = {}) => {
        //       const clerkToken = await getToken();
        //       const headers = new Headers(init.headers);
        //       if (clerkToken) {
        //         headers.set('Authorization', `Bearer ${clerkToken}`);
        //       }
        //       return fetch(input, { ...init, headers });
        //     },
        //   },
        //   auth: {
        //     autoRefreshToken: false,
        //     persistSession: false,
        //     detectSessionInUrl: false,
        //   },
        // });
        ```
    - [x] **Important:** After a user signs in with Clerk, the Supabase client will automatically use the token for subsequent requests due to the custom fetch.

- [x] **2.5. Add Clerk Sign-In UI Components:**
    - [x] Integrate Clerk's pre-built UI components (e.g., `<SignInButton>`, `<SignIn>`, `<SignUpButton>`, `<SignUp>`, `<UserButton>`) into your application where authentication is handled (e.g., Login page, Navbar).
    - [x] Ensure you provide a clear "Sign in with Metamask" option. Clerk components will show Metamask if it's enabled in your Clerk dashboard.
        ```tsx
        // Example in a LoginPage.tsx or NavBar.tsx
        // import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/clerk-react";
        //
        // function AuthButtons() {
        //   return (
        //     <div>
        //       <SignedOut>
        //         {/* This will show all configured Clerk sign-in methods, including Metamask if enabled */}
        //         <SignInButton mode="modal" />
        //         {/* Add your existing Supabase email/password sign-in button here */}
        //         {/* <button onClick={handleSupabaseEmailSignIn}>Sign in with Email (Supabase)</button> */}
        //       </SignedOut>
        //       <SignedIn>
        //         <UserButton afterSignOutUrl="/" />
        //       </SignedIn>
        //     </div>
        //   );
        // }
        ```

- [x] **2.6. Handle Authentication State & Supabase Session:**
    - [x] Use Clerk's hooks (e.g., `useUser`, `useAuth`) to manage authentication state.
    - [x] The Supabase client is configured (in 2.4) to automatically use the Clerk token. No separate `AuthHandler` component or manual `supabase.auth.setSession()` calls are needed for client-side operations. Clerk's `useAuth` and related hooks become the source of truth for UI changes.

- [x] **2.7. Update Data Fetching Logic:**
    - [x] Ensure all Supabase queries are made using the Supabase client that is authenticated via the Clerk token. RLS policies will handle data access control. (This is implicitly handled by updating the Supabase client in step 2.4).

- [x] **2.8. Adjust `ProtectedRoute` and other auth-dependent components:**
    - [x] Your `ProtectedRoute.tsx` and any other components that rely on authentication status will now need to check Clerk's authentication state (e.g., using `useAuth().isSignedIn`).
        ```tsx
        // Example in ProtectedRoute.tsx
        // import { useAuth } from '@clerk/clerk-react';
        // import { Navigate, Outlet } from 'react-router-dom';
        //
        // export const ProtectedRoute = () => {
        //   const { isSignedIn, isLoaded } = useAuth();
        //
        //   if (!isLoaded) {
        //     return <div>Loading...</div>; // Or a spinner component
        //   }
        //
        //   if (!isSignedIn) {
        //     return <Navigate to="/login" replace />; // Or your sign-in page
        //   }
        //
        //   return <Outlet />;
        // };
        ```
    - [x] Remove old `AuthContext.tsx` and `AuthProvider` as Clerk is now the auth manager.

## Phase 3: Debugging Current Issues (As of 2025-05-09)

This section outlines the steps to resolve issues identified during development after the initial Clerk integration.

### Issue 1: "Invalid input syntax for type uuid" in Lobby

**Symptoms:**
- Errors in the browser console on the Lobby page: `Error fetching profile: Object { code: "22P02", ..., message: 'invalid input syntax for type uuid: "user_2wrieISbC..."' }`
- This prevents user profiles from loading correctly in the lobby.

**Cause:**
- The `profiles.id` column in your Supabase database is of type `uuid`.
- Clerk user IDs (e.g., `user_2wrieISbC...`) are strings (TEXT) and are not valid UUIDs.
- The `getProfile` function attempts to query `profiles.id` using the Clerk user ID, leading to a type mismatch.
- This also previously caused issues with applying RLS policies to the `profiles` table.

**Resolution Steps (Execute in Supabase SQL Editor):**

1.  **Drop Existing RLS Policies on `profiles` Table:**
    -   You cannot alter the column type while it's used in RLS policies.
    ```sql
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    -- Add any other RLS policy names you have on the public.profiles table.
    ```

2.  **Alter `profiles.id` Column Type to TEXT:**
    ```sql
    ALTER TABLE public.profiles
    ALTER COLUMN id TYPE TEXT;
    ```

3.  **Recreate RLS Policies for `profiles` Table:**
    -   These policies now correctly compare `TEXT` (profiles.id) with `TEXT` (Clerk user ID from JWT).
    ```sql
    CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.jwt()->>'sub'));

    CREATE POLICY "Users can create their own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = (SELECT auth.jwt()->>'sub'));

    CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = (SELECT auth.jwt()->>'sub'))
    WITH CHECK (id = (SELECT auth.jwt()->>'sub'));

    -- Optional: Add a DELETE policy if users should be able to delete their own profiles.
    -- CREATE POLICY "Users can delete their own profile"
    -- ON public.profiles
    -- FOR DELETE
    -- TO authenticated
    -- USING (id = (SELECT auth.jwt()->>'sub'));
    ```

4.  **Verify:**
    -   After applying these changes, reload the Lobby page in the application.
    -   Confirm that the "invalid input syntax for type uuid" errors are gone and profiles load as expected.

### Issue 2: `deal-cards` Edge Function Fails After Joining Game

**Symptoms:**
- After a second player joins a game, the client attempts to call the `deal-cards` Supabase Edge Function.
- The call fails, and the browser console shows: `[Lobby] Error calling deal-cards function: FunctionsHttpError: Edge Function returned a non-2xx status code`.
- Supabase function logs show `"reason": "EarlyDrop"` for shutdown events, but the critical error message from the function's `catch` block or other `console.error` statements needs to be located.

**Potential Causes & Debugging Steps:**

1.  **Prerequisite: Resolve Issue 1 First.**
    -   It's possible the `deal-cards` function (or functions it calls) might indirectly try to access profile data. Resolving the `profiles.id` type issue is essential.

2.  **Re-test and Check Detailed Function Logs:**
    -   After resolving Issue 1, attempt the "join game" flow again.
    -   If the error persists, go to your Supabase Project Dashboard -> Edge Functions -> select the `deal-cards` function -> Logs.
    -   **Crucially, look for log entries that are NOT just "shutdown" or "EarlyDrop". Find the actual error message logged by your function's `console.error()` calls** (e.g., `[deal-cards] Supabase update error...` or `[deal-cards] Error processing request...`). This specific error is key.

3.  **Based on the Detailed Error Log, Investigate:**

    a.  **Environment Variables for the Function:**
        -   In the Supabase Dashboard (Function settings), verify that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correctly set and accessible to the function. The Service Role Key is vital for bypassing RLS.

    b.  **`gameId` Parameter:**
        -   Ensure the `gameId` is being correctly passed from the client and received by the function. Your function code already logs this: `console.log(\`[deal-cards] Received request for gameId: \${gameId}\`);`. Check if this log appears and if `gameId` is valid.

    c.  **`games` Table Schema for Hands & Status:**
        -   Verify the `games` table in Supabase has columns: `player1_dealt_hand` and `player2_dealt_hand`.
        -   These columns **must be of type `TEXT[]` (array of text) or `JSONB`** to store the arrays of creature IDs.
        -   Ensure the `status` column exists and can accept the value `'selecting'`.
        -   Ensure the `id` column (for `gameId`) and `player2_id` column exist and are of appropriate types (likely `TEXT` for `player2_id` if it stores Clerk user IDs, and `uuid` or `TEXT` for `game.id` depending on how it's generated).

    d.  **Database Update Operation (`supabaseAdmin.from('games').update(...)`):**
        -   The detailed error log will likely point here if it's a database issue.
        -   The condition `.not('player2_id', 'is', null)` means the update will only proceed if `player2_id` is set. Confirm this is the case when `deal-cards` is called.
        -   Any RLS policies on the `games` table should be bypassed by `supabaseAdmin` (using the Service Role Key), but a misconfigured key would cause issues.

    e.  **`../_shared/cors.ts` Import:**
        -   Ensure the `_shared/cors.ts` file exists in your Supabase function deployment environment and is correctly structured. If this import fails, the function may not initialize correctly.

4.  **Iterative Testing:**
    -   Make one change at a time based on the logs and re-test to isolate the cause.

## Phase 4: Testing and Refinement

- [ ] **4.1. Test Sign-up and Sign-in with Metamask (Clerk):**
    - [ ] Verify that users can sign up and sign in using Metamask through the Clerk UI.
    - [ ] Confirm that a Clerk user is created.
    - [ ] Confirm that the Supabase client is correctly authenticated using the Clerk token (e.g., by making a test query to a table with RLS).

- [ ] **4.2. Test Data Access with RLS:**
    - [ ] Create data as a Metamask-authenticated user.
    - [ ] Verify that this user can only see and modify their own data.
    - [ ] Sign in as a different user (either another Metamask user or an existing email/password user).
    - [ ] Verify that this second user cannot see or modify the first user's data (and vice-versa), according to your RLS policies.

- [ ] **4.3. Test Existing Supabase Email/Password Auth (DEPRECATED - For Review Only):**
    - [ ] **Note:** Direct Supabase email/password authentication UI has been removed in favor of Clerk. This section is for ensuring any backend logic or RLS related to potentially existing Supabase-native users is handled or understood.
    - [ ] If there are existing users authenticated directly via Supabase, review how their RLS policies interact with users authenticated via Clerk. The primary user ID is now expected to be the Clerk user ID.

- [ ] **4.4. Test Sign Out:**
    - [ ] Verify that signing out from Clerk correctly clears the session and revokes access to protected routes and data.

- [ ] **4.5. Review UI/UX:**
    - [ ] Ensure the login/signup flow is clear.
    - [ ] Check for any console errors or unexpected behavior during normal user flows.

## Notes & Considerations:

*   **User Data Synchronization:** Clerk and Supabase user tables are separate. If you need to store Clerk user attributes (like email, name from Metamask, etc.) in your Supabase `profiles` table, you'll typically use Clerk Webhooks to listen for user creation/update events and then sync that data to your Supabase table. The `user_id` column in Supabase tables (used for RLS with Clerk) will link to Clerk's `user.id` (which is the `sub` claim in the JWT).
*   **Existing Users & Data:** If you have existing users authenticated directly with Supabase, carefully consider how their data and RLS policies will interact with new users authenticated via Clerk. See point 3.3 for RLS strategies.
*   **Clerk's Supabase Integration:** Prioritize using official methods like the `createClerkSupabaseClient()` helper if available for your framework (this is the recommended approach by Clerk for client-side Supabase client creation). If manually managing tokens (e.g., in a backend or for specific scenarios not covered by the helper), use the standard Clerk session token (e.g., from `await getToken()` or `session.getToken()`) with Supabase's `setSession` method after configuring Clerk as a third-party auth provider in Supabase (as per step 1.2). The older Supabase JWT template (e.g., `getToken({ template: 'supabase' })`) is deprecated as of April 1st, 2025, in favor of this native integration.
*   **Metamask Specifics:** While Clerk handles the Metamask interaction, ensure your Clerk instance is correctly configured in the Clerk Dashboard to offer Metamask (Web3) as a sign-in option.
*   **Token Refresh:** Clerk's SDKs typically handle token refresh automatically. If you are manually setting the token with Supabase, ensure your logic re-sets the Supabase session if the Clerk token is refreshed. The `AuthHandler` example attempts to address this by re-running on `getToken` changes, but ensure this aligns with your Clerk SDK's behavior. Using `createClerkSupabaseClient` is often simpler as it's designed to handle these details.
