import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithMagicLink: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getOrCreateProfile: vi.fn(),
  getLinkedPolygonWallet: vi.fn(),
  connectLinkedPolygonWallet: vi.fn(),
}));

vi.mock('../../src/services/mythicalClient.js', () => ({
  mythical: {
    auth: {
      getSession: authMocks.getSession,
      getUser: authMocks.getUser,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithMagicLink: authMocks.signInWithMagicLink,
      signInWithOAuth: authMocks.signInWithOAuth,
      signOut: authMocks.signOut,
    },
    profile: {
      getOrCreate: authMocks.getOrCreateProfile,
    },
  },
}));

vi.mock('../../src/services/playHubAuthService.js', () => ({
  signInWithGoogle: authMocks.signInWithOAuth,
}));

vi.mock('../../src/services/playHubWalletService.js', () => ({
  getLinkedPolygonWallet: authMocks.getLinkedPolygonWallet,
  connectLinkedPolygonWallet: authMocks.connectLinkedPolygonWallet,
}));

let idleHandle = 0;
let idleCallbacks: Map<number, IdleRequestCallback>;

function resetAuthMocks() {
  for (const mock of Object.values(authMocks)) mock.mockReset();
  authMocks.getSession.mockResolvedValue(null);
  authMocks.getUser.mockResolvedValue(null);
  authMocks.onAuthStateChange.mockReturnValue(undefined);
  authMocks.signInWithMagicLink.mockResolvedValue(undefined);
  authMocks.signInWithOAuth.mockResolvedValue(undefined);
  authMocks.signOut.mockResolvedValue(undefined);
  authMocks.getOrCreateProfile.mockResolvedValue(null);
  authMocks.getLinkedPolygonWallet.mockResolvedValue(null);
  authMocks.connectLinkedPolygonWallet.mockResolvedValue({
    chain: 'polygon',
    address: '0x1234567890abcdef1234567890abcdef12345678',
  });
}

function installIdleHarness() {
  idleHandle = 0;
  idleCallbacks = new Map();
  Object.defineProperty(window, 'requestIdleCallback', {
    configurable: true,
    value: vi.fn((callback: IdleRequestCallback) => {
      const handle = ++idleHandle;
      idleCallbacks.set(handle, callback);
      return handle;
    }),
  });
  Object.defineProperty(window, 'cancelIdleCallback', {
    configurable: true,
    value: vi.fn((handle: number) => idleCallbacks.delete(handle)),
  });
}

async function renderAuthProbe(pathname: string, strict = false) {
  window.history.replaceState({}, '', pathname);
  const [{ AuthProvider }, { useAuth }] = await Promise.all([
    import('../../src/context/AuthProvider.js'),
    import('../../src/hooks/useAuth.js'),
  ]);

  function Probe() {
    const auth = useAuth();
    const status = auth.loading
      ? 'loading'
      : auth.error
        ? `error:${auth.error}`
        : auth.user
          ? 'authenticated'
          : 'visitor';

    return (
      <>
        <output aria-label="Auth status">{status}</output>
        <button
          type="button"
          onClick={() => void auth.signInWithPlayHubEmail('Player@Example.com')}
        >
          Email sign-in
        </button>
      </>
    );
  }

  const content = <AuthProvider><Probe /></AuthProvider>;
  const wrapper = strict ? <StrictMode>{content}</StrictMode> : content;
  return render(wrapper);
}

async function runIdleCallbacks() {
  const callbacks = [...idleCallbacks.values()];
  await act(async () => {
    for (const callback of callbacks) {
      callback({ didTimeout: false, timeRemaining: () => 10 });
    }
  });
}

describe('AuthProvider bootstrap integration', () => {
  beforeEach(() => {
    vi.resetModules();
    resetAuthMocks();
    installIdleHarness();
    window.localStorage.clear();
  });

  it('defers SDK access on a public route until idle', async () => {
    await renderAuthProbe('/');

    expect(screen.getByLabelText('Auth status')).toHaveTextContent('loading');
    expect(authMocks.getSession).not.toHaveBeenCalled();

    await runIdleCallbacks();

    await waitFor(() => expect(screen.getByLabelText('Auth status')).toHaveTextContent('visitor'));
    expect(authMocks.getSession).toHaveBeenCalledOnce();
    expect(authMocks.onAuthStateChange).toHaveBeenCalledOnce();
  });

  it('initializes immediately on a protected route', async () => {
    await renderAuthProbe('/lobby');

    await waitFor(() => expect(authMocks.getSession).toHaveBeenCalledOnce());
    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('visitor');
  });

  it('finishes loading with a recoverable error when the SDK request fails', async () => {
    authMocks.getSession.mockRejectedValueOnce(new Error('Play Hub unavailable'));

    await renderAuthProbe('/profile');

    await waitFor(() => expect(screen.getByLabelText('Auth status')).toHaveTextContent(
      'error:Play Hub unavailable',
    ));
    expect(screen.getByLabelText('Auth status')).not.toHaveTextContent('loading');
  });

  it('allows an auth action before the public-route idle callback', async () => {
    const user = userEvent.setup();
    await renderAuthProbe('/how-to-play');

    await user.click(screen.getByRole('button', { name: 'Email sign-in' }));

    await waitFor(() => expect(authMocks.signInWithMagicLink).toHaveBeenCalledWith(
      'player@example.com',
      window.location.origin,
    ));
    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Auth status')).toHaveTextContent('visitor');
  });

  it('deduplicates initialization under StrictMode', async () => {
    await renderAuthProbe('/', true);

    expect(idleCallbacks.size).toBe(1);
    await runIdleCallbacks();

    await waitFor(() => expect(authMocks.getSession).toHaveBeenCalledOnce());
    expect(authMocks.onAuthStateChange).toHaveBeenCalledOnce();
  });
});
