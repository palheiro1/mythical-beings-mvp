import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  getStatus: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('../../src/services/mythicalClient.js', () => ({
  mythical: {
    auth: {
      signInWithOAuth: sdkMocks.signInWithOAuth,
    },
    wallets: {
      connect: sdkMocks.connect,
      getStatus: sdkMocks.getStatus,
    },
  },
}));

import { signInWithGoogle } from '../../src/services/playHubAuthService.js';
import { connectLinkedPolygonWallet, getLinkedPolygonWallet } from '../../src/services/playHubWalletService.js';

const linkedPolygonWallet = {
  id: 'wallet-1',
  profile_id: 'profile-1',
  chain: 'polygon',
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  is_primary: true,
  verified_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Play Hub SDK wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.getStatus.mockResolvedValue(linkedPolygonWallet);
    sdkMocks.connect.mockResolvedValue(linkedPolygonWallet);
    sdkMocks.signInWithOAuth.mockResolvedValue(undefined);
  });

  it('uses SDK OAuth for Google sign-in', async () => {
    await signInWithGoogle();

    expect(sdkMocks.signInWithOAuth).toHaveBeenCalledWith('google', window.location.origin);
  });

  it('links Polygon wallets through mythical.wallets.connect', async () => {
    const wallet = await connectLinkedPolygonWallet();

    expect(sdkMocks.connect).toHaveBeenCalledWith('polygon');
    expect(wallet).toEqual(linkedPolygonWallet);
  });

  it('returns null when no Polygon wallet is linked', async () => {
    sdkMocks.getStatus.mockResolvedValue(null);

    await expect(getLinkedPolygonWallet()).resolves.toBeNull();
  });
});
