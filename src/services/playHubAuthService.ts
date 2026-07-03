import { mythical } from './mythicalClient.js';

function getRedirectUrl(): string {
  return window.location.origin;
}

export async function signInWithGoogle(): Promise<void> {
  await mythical.auth.signInWithOAuth('google', getRedirectUrl());
}
