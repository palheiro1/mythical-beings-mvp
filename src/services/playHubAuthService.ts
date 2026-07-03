import { LinkedWallet } from '@mythicalb/sdk';
import { getPolygonProvider } from '../config/playhub.js';
import { mythical } from './mythicalClient.js';
import { getLinkedPolygonWallet } from './playHubWalletService.js';

const WEB3_SIGN_IN_STATEMENT = 'Sign in to Wisdom Duel with your Polygon wallet.';

function getRedirectUrl(): string {
  return window.location.origin;
}

export async function signInWithGoogle(): Promise<void> {
  await mythical.auth.signInWithOAuth('google', getRedirectUrl());
}

export async function signInWithPolygonWeb3(): Promise<LinkedWallet> {
  const provider = getPolygonProvider();

  await mythical.auth.signInWithPolygonWallet({
    wallet: provider,
    statement: WEB3_SIGN_IN_STATEMENT,
    url: window.location.href,
  });

  return ensureAuthenticatedPolygonWallet();
}

export async function ensureAuthenticatedPolygonWallet(): Promise<LinkedWallet> {
  const wallet = await getLinkedPolygonWallet();

  if (!wallet) {
    throw new Error('Play Hub did not return a verified Polygon wallet.');
  }

  return wallet;
}
