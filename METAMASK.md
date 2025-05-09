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

## Phase 3: Testing and Refinement

- [ ] **3.1. Test Sign-up and Sign-in with Metamask (Clerk):**
    - [ ] Verify that users can sign up and sign in using Metamask through the Clerk UI.
    - [ ] Confirm that a Clerk user is created.
    - [ ] Confirm that the Supabase client is correctly authenticated using the Clerk token (e.g., by making a test query to a table with RLS).

- [ ] **3.2. Test Data Access with RLS:**
    - [ ] Create data as a Metamask-authenticated user.
    - [ ] Verify that this user can only see and modify their own data.
    - [ ] Sign in as a different user (either another Metamask user or an existing email/password user).
    - [ ] Verify that this second user cannot see or modify the first user's data (and vice-versa), according to your RLS policies.

- [ ] **3.3. Test Existing Supabase Email/Password Auth:**
    - [ ] Ensure that the original Supabase email/password authentication system still works as expected.
    - [ ] Verify RLS policies for users authenticated via the original Supabase auth. **This is a critical point**: If you have existing users and data tied to Supabase's `auth.uid()`, you'll need a strategy for RLS. This might involve:
        - Migrating existing `auth.uid()` in your tables to match Clerk's `sub` if users link accounts or are migrated.
        - Having RLS policies that can check `auth.uid()` (for Supabase-direct auth) OR `auth.jwt()->>'sub'` (for Clerk-brokered auth). Example: `USING ( (auth.uid() = user_id_column_for_supabase_auth) OR ((select auth.jwt()->>'sub') = user_id_column_for_clerk_auth) )` - this requires careful schema design.
        - Keeping them separate if the user bases and their data access are intended to be distinct.

- [ ] **3.4. Test Sign Out:**
    - [ ] Verify that signing out from Clerk also effectively signs the user out from the Supabase session managed by the Clerk token (e.g., `updateSupabaseAuthWithClerkToken(null)` is called).
    - [ ] Verify sign out for the original Supabase auth.

- [ ] **3.5. Review UI/UX:**
    - [ ] Ensure the login/signup flow is clear and users understand they have multiple options (Metamask via Clerk, and Email/Password via Supabase).
    - [ ] Check for any console errors or unexpected behavior.

## Notes & Considerations:

*   **User Data Synchronization:** Clerk and Supabase user tables are separate. If you need to store Clerk user attributes (like email, name from Metamask, etc.) in your Supabase `profiles` table, you'll typically use Clerk Webhooks to listen for user creation/update events and then sync that data to your Supabase table. The `user_id` column in Supabase tables (used for RLS with Clerk) will link to Clerk's `user.id` (which is the `sub` claim in the JWT).
*   **Existing Users & Data:** If you have existing users authenticated directly with Supabase, carefully consider how their data and RLS policies will interact with new users authenticated via Clerk. See point 3.3 for RLS strategies.
*   **Clerk's Supabase Integration:** Prioritize using official methods like the `createClerkSupabaseClient()` helper if available for your framework (this is the recommended approach by Clerk for client-side Supabase client creation). If manually managing tokens (e.g., in a backend or for specific scenarios not covered by the helper), use the standard Clerk session token (e.g., from `await getToken()` or `session.getToken()`) with Supabase's `setSession` method after configuring Clerk as a third-party auth provider in Supabase (as per step 1.2). The older Supabase JWT template (e.g., `getToken({ template: 'supabase' })`) is deprecated as of April 1st, 2025, in favor of this native integration.
*   **Metamask Specifics:** While Clerk handles the Metamask interaction, ensure your Clerk instance is correctly configured in the Clerk Dashboard to offer Metamask (Web3) as a sign-in option.
*   **Token Refresh:** Clerk's SDKs typically handle token refresh automatically. If you are manually setting the token with Supabase, ensure your logic re-sets the Supabase session if the Clerk token is refreshed. The `AuthHandler` example attempts to address this by re-running on `getToken` changes, but ensure this aligns with your Clerk SDK's behavior. Using `createClerkSupabaseClient` is often simpler as it's designed to handle these details.
