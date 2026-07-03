export const PLAYHUB_GAME_ID = 'card_game';
export const PLAYHUB_MODE_ID = 'casual';
export const PLAYHUB_COMPETITIVE_MODE_ID = 'competitive_gem';
export const PLAYHUB_SEASON_ID = 'card_game_casual_season_1';
export const PLAYHUB_DEFAULT_STAKE_GEM = '5';

export const PLAYHUB_APP_NAME = 'Wisdom Duel';
export const PLAYHUB_APP_ICON_URL = '/logos/icon-192.png';

export const PLAYHUB_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const PLAYHUB_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const POLYGON_RPC_URL = import.meta.env.VITE_POLYGON_RPC_URL || undefined;
export const POLYGON_CHAIN_ID = Number(import.meta.env.VITE_POLYGON_CHAIN_ID || '137');
export const GEM_CONTRACT = import.meta.env.VITE_GEM_CONTRACT || '0x5f790ffa0695967a2d711872ecb4c7553e24794d';
export const CARDS_CONTRACT = import.meta.env.VITE_CARDS_CONTRACT || '0xcf55f528492768330c0750a6527c1dfb50e2a7c3';
export const WISDOM_DUEL_ESCROW_ADDRESS = import.meta.env.VITE_WISDOM_DUEL_ESCROW_ADDRESS || undefined;

if (!PLAYHUB_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is not set. Please check your .env.local file.');
}

if (!PLAYHUB_SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not set. Please check your .env.local file.');
}

export function getPolygonProvider() {
  return {
    request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }) {
      const provider = (globalThis as typeof globalThis & {
        ethereum?: {
          request<T = unknown>(args: {
            method: string;
            params?: unknown[] | Record<string, unknown>;
          }): Promise<T>;
        };
      }).ethereum;

      if (!provider) {
        return Promise.reject(new Error('No Polygon wallet provider found. Install or unlock a browser wallet first.'));
      }

      return provider.request<T>(args);
    },
  };
}

export function hasPolygonProvider(): boolean {
  return Boolean((globalThis as typeof globalThis & {
    ethereum?: {
      request<T = unknown>(args: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }): Promise<T>;
    };
  }).ethereum);
}
