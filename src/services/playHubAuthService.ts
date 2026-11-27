import { mythical } from './mythicalClient.js';
import { playHubRedirectUrl } from '../game/duelInvitation.js';

export async function signInWithGoogle(): Promise<void> {
  await mythical.auth.signInWithOAuth('google', playHubRedirectUrl());
}
