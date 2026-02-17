# Authentication & Profile Synchronization

## Overview

This document provides technical details about the implementation of synchronized authentication and profile creation for the Card Game project. The implementation follows the phased approach outlined in `METAMASK.md`.

## Implementation Details

### Core Components

1. **Auth State Observer (`useAuthProfileSync` hook)**
   - Monitors authentication state changes
   - Automatically creates user profiles when a user signs in
   - Integrated globally in `App.tsx`

2. **Database Security**
   - Row-Level Security (RLS) policies for profiles table:
     - Users can create their own profiles
     - Users can update their own profiles
   - Deployed via Supabase MCP server

3. **Wallet Authentication Enhancement**
   - `authenticateWithWallet` function in `Lobby.tsx` creates profiles immediately after authentication
   - Ensures wallet addresses are properly stored in user metadata

4. **Database Function**
   - The `ensure_profile_exists` PostgreSQL function provides a reusable way to create profiles
   - Used by edge functions and other server-side components

5. **Game Creation Safeguards**
   - Profile existence verification before game creation in:
     - Client-side `createGame` function
     - Server-side edge function
     - `joinGame` function for the second player

## How It Works

The implementation creates multiple layers of protection to ensure profiles are always created:

1. When a user authenticates, the `useAuthProfileSync` hook creates a profile if needed
2. When a user connects their wallet, the `authenticateWithWallet` function creates a profile
3. Before creating or joining a game, the `ensureProfileExists` function verifies profile existence
4. The edge function that creates games also ensures profiles exist

This redundancy ensures that no matter which path a user takes, they will always have a profile before attempting actions that require one, preventing foreign key constraint errors.

## Technical Changes

- Added new hook in `src/hooks/useAuthProfileSync.ts`
- Updated `App.tsx` to use the hook globally
- Enhanced `Lobby.tsx` to create profiles after wallet authentication
- Added `ensureProfileExists` function in `supabase.ts`
- Created database function and RLS policies through Supabase MCP
- Created verification script `apply-auth-profile-sync.sh`
- Added utility for repairing orphaned accounts (`scripts/repair-orphaned-accounts.ts`)

## Testing

The implementation can be tested by:

1. Connecting a wallet on the home page
2. Checking console logs to verify profile creation
3. Creating a game and verifying no foreign key constraint errors occur
4. Rejoining an existing game after authentication
5. Testing session persistence by refreshing the page
6. Verifying profile data is retained correctly

## Troubleshooting

If issues persist:

1. Check browser console for authentication or Supabase errors
2. Verify RLS policies are correctly applied on the profiles table
3. Run the repair script to fix any orphaned accounts
4. Check that all database functions are correctly deployed

## Future Improvements

- Add more robust error handling and recovery mechanisms
- Implement a background job to periodically check and repair orphaned accounts
- Add monitoring for authentication and profile creation failures
