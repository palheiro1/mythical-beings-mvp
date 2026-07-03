# Polygon + Play Hub Integration

Wisdom Duel uses Mythical Play Hub for identity, profiles, sessions, leaderboards, linked wallets, and competitive GEM flows. Polygon is the active chain for wallet login/linking, GEM stake deposits, ERC-1155 card ownership checks, and escrow settlement.

## Runtime Contract

- Game id: `card_game`
- Casual mode: `casual`
- Competitive mode: `competitive_gem`
- Season id: `card_game_casual_season_1`
- Polygon chain id: `137`
- Supported GEM stakes: `5`, `10`, `25`

The frontend uses `@mythicalb/sdk` through `src/services/mythicalClient.ts`.

## SDK Dependency

`@mythicalb/sdk@0.1.1` is required for Polygon auth, tokens, assets, and competition modules. If `0.1.1` is not published to npm yet, keep the generated in-repo tarball under `vendor/` as the reproducible dependency for builds. Replace it with `@mythicalb/sdk:^0.1.1` after publishing.

## Supabase Deploy Checklist

Apply or verify these migrations in the Play Hub Supabase project:

- `profile_wallets`, `profile_wallet_challenges`, `playhub_get_profile_wallets`
- `playhub_ensure_auth_wallet`
- `card_game` game registration, `casual` mode, `competitive_gem` mode
- `card_game_session_state`
- `card_game_competitions`, `card_game_competition_deposits`
- `mythical_assets` rows for Wisdom Duel Polygon ERC-1155 cards

Deploy app function:

```bash
supabase functions deploy deal-cards --project-ref zbmkhvpokopvhnochcjr
```

Deploy SDK functions from the `mythicalSDK` repo:

```bash
npm run supabase:deploy
```

Required function secrets:

- `POLYGON_RPC_URL`
- `POLYGON_CHAIN_ID=137`
- `WISDOM_DUEL_GEM_ADDRESS`
- `WISDOM_DUEL_CARDS_ADDRESS`
- `WISDOM_DUEL_ESCROW_ADDRESS`
- `WISDOM_DUEL_ESCROW_SIGNER_PRIVATE_KEY`
- `WISDOM_DUEL_GEM_DECIMALS=18`

`WISDOM_DUEL_ESCROW_ADDRESS` and `WISDOM_DUEL_ESCROW_SIGNER_PRIVATE_KEY` are mandatory for Competitive GEM deposits and settlement authorization. Configure them before running E2E:

```bash
supabase secrets set WISDOM_DUEL_ESCROW_ADDRESS=0x... WISDOM_DUEL_ESCROW_SIGNER_PRIVATE_KEY=...
```

## Play Hub Listing

The `wallet` repo exposes Wisdom Duel from `src/components/Pages/PlayHubPage/data.js` as an external app. Set `VITE_WISDOM_DUEL_URL` in the Play Hub deployment.

## Acceptance Test

1. Sign in to Play Hub with two accounts.
2. Link two Polygon wallets.
3. Confirm both wallets own enough GEM and at least five eligible ERC-1155 cards.
4. Create a Competitive GEM session at each supported stake.
5. Join with session code.
6. Deposit stake from both wallets.
7. Verify cards are dealt only from owned ERC-1155 assets.
8. Finish the match and submit escrow settlement.
9. Confirm `card_game_competitions.settlement_status='settled'` and tx hashes are present.
10. Confirm casual mode still starts, deals, and finishes without Polygon stake.
