# Authentication (MetaMask + Supabase)

## Current Flow

1. The client connects to MetaMask and requests a `personal_sign` signature.
   - Code: `src/services/metamaskAuth.ts`
2. The client calls the Supabase Edge Function `moralis-auth` with `{ message, signature }`.
   - Code: `supabase/functions/moralis-auth/index.ts`
3. The Edge Function verifies the signature, ensures an Auth user + profile exists, then creates a real Supabase session via `signInWithPassword`.
4. The Edge Function returns `{ access_token, refresh_token }` and the client establishes the session using `supabase.auth.setSession({ access_token, refresh_token })`.

Notes:
- The Edge Function name is historical (`moralis-auth`) but signature verification is performed locally in the function (no Moralis SDK is required in the client).
- A fallback Edge Function `simplified-moralis-auth` may be used if the primary function fails.

## Environment Variables

Frontend (`.env.local`, see `.env.example`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Edge Functions (Supabase project secrets):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_PASSWORD_SECRET` (server-only secret used to derive per-wallet passwords deterministically)

## CORS / Connectivity Troubleshooting

If you see browser errors like:
- `CORS request did not succeed`
- `FunctionsFetchError: Failed to send a request to the Edge Function`

It is often a *connectivity* problem (DNS/TLS/network) or a Supabase Edge Function gateway rejection before your function code runs.

1. Verify your Supabase project URL is valid/reachable:
   - `nslookup <project-ref>.supabase.co`
   - `curl -I https://<project-ref>.supabase.co/auth/v1/health`
2. Ensure Edge Functions called from the browser have `verify_jwt = false` in `supabase/config.toml`.
   - Reason: browser `OPTIONS` preflight requests do **not** include the `Authorization` header, so `verify_jwt = true` can cause preflight to be rejected, which surfaces as a CORS failure in the browser.
3. Redeploy functions after changing `supabase/config.toml` or function code.

## Deploying Edge Functions

Typical workflow:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy moralis-auth
supabase functions deploy simplified-moralis-auth
supabase functions deploy create-game
supabase functions deploy deal-cards
```

## Source Of Truth

- Client auth service: `src/services/metamaskAuth.ts`
- Auth state management: `src/context/AuthProvider.tsx`
- Edge auth verification: `supabase/functions/moralis-auth/index.ts`
