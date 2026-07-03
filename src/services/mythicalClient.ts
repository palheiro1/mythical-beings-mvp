import { createMythicalSDK } from '@mythicalb/sdk';
import {
  getPolygonProvider,
  CARDS_CONTRACT,
  GEM_CONTRACT,
  POLYGON_CHAIN_ID,
  POLYGON_RPC_URL,
  PLAYHUB_GAME_ID,
  PLAYHUB_MODE_ID,
  PLAYHUB_SEASON_ID,
  PLAYHUB_SUPABASE_ANON_KEY,
  PLAYHUB_SUPABASE_URL,
  WISDOM_DUEL_ESCROW_ADDRESS,
} from '../config/playhub.js';

export const mythical = createMythicalSDK({
  supabase: {
    url: PLAYHUB_SUPABASE_URL,
    anonKey: PLAYHUB_SUPABASE_ANON_KEY,
    detectSessionInUrl: true,
  },
  game: {
    id: PLAYHUB_GAME_ID,
    modeId: PLAYHUB_MODE_ID,
    seasonId: PLAYHUB_SEASON_ID,
  },
  polygon: {
    provider: getPolygonProvider(),
    rpcUrl: POLYGON_RPC_URL,
    chainId: POLYGON_CHAIN_ID,
    contracts: {
      gem: GEM_CONTRACT,
      cards: CARDS_CONTRACT,
      escrow: WISDOM_DUEL_ESCROW_ADDRESS,
    },
  },
});

export const playHubSupabase = mythical.supabase;
