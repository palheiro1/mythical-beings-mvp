# Authentication (Play Hub + Polygon)

## Current Flow

1. The app creates a single Mythical SDK client in `src/services/mythicalClient.ts`.
2. Supabase session state is read through `mythical.auth`.
3. Users sign in with Google or an email magic link from `src/pages/Home.tsx`.
4. Authenticated users link a Polygon wallet through `mythical.wallets.connect('polygon')`.
5. Protected routes require both a Play Hub user session and a linked Polygon wallet.

Browser wallets are only accessed through the Play Hub SDK. The game does not call Moralis or maintain a separate wallet-auth backend.

## Environment Variables

Frontend (`.env.local`, see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_POLYGON_RPC_URL`
- `VITE_POLYGON_CHAIN_ID`
- `VITE_GEM_CONTRACT`
- `VITE_CARDS_CONTRACT`
- `VITE_WISDOM_DUEL_ESCROW_ADDRESS`

Supabase Edge Function secrets:

- `POLYGON_RPC_URL`
- `POLYGON_CHAIN_ID`
- `WISDOM_DUEL_GEM_ADDRESS`
- `WISDOM_DUEL_CARDS_ADDRESS`
- `WISDOM_DUEL_ESCROW_ADDRESS`
- `WISDOM_DUEL_ESCROW_SIGNER_PRIVATE_KEY`
- `WISDOM_DUEL_GEM_DECIMALS`

## Deploying Edge Functions

The active app-specific Edge Function is:

```bash
supabase functions deploy deal-cards
```

Authentication, profiles, wallet linking, sessions, leaderboards, rewards, and competitive GEM functions are routed through `@mythicalb/sdk`.

## Source Of Truth

- SDK client: `src/services/mythicalClient.ts`
- Auth state management: `src/context/AuthProvider.tsx`
- Login UI: `src/pages/Home.tsx`
- Route gate: `src/components/ProtectedRoute.tsx`
