import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { LinkedWallet, PlayHubProfile, PlayHubUser } from '@mythicalb/sdk';
import { mythical } from '../services/mythicalClient.js';
import { hasPolygonProvider, PLAYHUB_ENABLE_WEB3_AUTH } from '../config/playhub.js';
import { signInWithGoogle, signInWithPolygonWeb3 } from '../services/playHubAuthService.js';
import { connectLinkedPolygonWallet, getLinkedPolygonWallet } from '../services/playHubWalletService.js';

export interface AuthState {
  user: PlayHubUser | null;
  profile: PlayHubProfile | null;
  polygonWallet: LinkedWallet | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  magicLinkSentTo: string | null;
  magicLinkCooldownUntil: number | null;
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithPolygonWallet: () => Promise<LinkedWallet>;
  signInWithPlayHubEmail: (email: string) => Promise<void>;
  connectPolygonWallet: () => Promise<LinkedWallet>;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let authStateManager: AuthStateManager | null = null;

const MAGIC_LINK_COOLDOWN_MS = 60_000;
const MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;
const MAGIC_LINK_COOLDOWN_STORAGE_KEY = 'playhub.magicLinkCooldown';

function getStoredMagicLinkCooldown(): Pick<AuthState, 'magicLinkSentTo' | 'magicLinkCooldownUntil'> {
  if (typeof window === 'undefined') {
    return { magicLinkSentTo: null, magicLinkCooldownUntil: null };
  }

  try {
    const raw = window.localStorage.getItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY);
    if (!raw) {
      return { magicLinkSentTo: null, magicLinkCooldownUntil: null };
    }

    const parsed = JSON.parse(raw) as { email?: unknown; until?: unknown };
    const until = typeof parsed.until === 'number' ? parsed.until : null;
    const email = typeof parsed.email === 'string' ? parsed.email : null;

    if (!until || until <= Date.now()) {
      window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY);
      return { magicLinkSentTo: null, magicLinkCooldownUntil: null };
    }

    return { magicLinkSentTo: email, magicLinkCooldownUntil: until };
  } catch {
    return { magicLinkSentTo: null, magicLinkCooldownUntil: null };
  }
}

function persistMagicLinkCooldown(email: string | null, until: number | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (!until || until <= Date.now()) {
      window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(MAGIC_LINK_COOLDOWN_STORAGE_KEY, JSON.stringify({ email, until }));
  } catch {
    // The cooldown is a UX guard only; auth still works if browser storage is unavailable.
  }
}

function formatWaitTime(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

function isEmailRateLimitError(error: unknown): boolean {
  const maybeError = error as { message?: unknown; status?: unknown; cause?: { message?: unknown; status?: unknown } };
  const message = String(maybeError?.message ?? maybeError?.cause?.message ?? '').toLowerCase();
  const status = maybeError?.status ?? maybeError?.cause?.status;

  return status === 429 || message.includes('rate limit') || message.includes('too many requests');
}

function getAuthErrorMessage(error: unknown): string {
  if (isEmailRateLimitError(error)) {
    return 'Play Hub email login is temporarily rate-limited. Check the last login email first, or try again in a few minutes.';
  }

  const maybeError = error as { message?: unknown };
  return typeof maybeError?.message === 'string' && maybeError.message
    ? maybeError.message
    : 'Could not send Play Hub login link.';
}

const storedMagicLinkCooldown = getStoredMagicLinkCooldown();

const initialAuthState: AuthState = {
  user: null,
  profile: null,
  polygonWallet: null,
  session: null,
  loading: true,
  error: null,
  magicLinkSentTo: storedMagicLinkCooldown.magicLinkSentTo,
  magicLinkCooldownUntil: storedMagicLinkCooldown.magicLinkCooldownUntil,
};

class AuthStateManager {
  private listeners: Set<(state: AuthState) => void> = new Set();
  private currentState: AuthState = initialAuthState;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    await this.refreshAuthState();

    mythical.auth.onAuthStateChange(() => {
      void this.refreshAuthState();
    });
  }

  private updateState(newState: Partial<AuthState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.listeners.forEach(listener => listener(this.currentState));
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.currentState);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  async refreshAuthState(): Promise<void> {
    this.updateState({ loading: true, error: null });

    try {
      const session = await mythical.auth.getSession();

      if (!session) {
        this.updateState({
          user: null,
          profile: null,
          polygonWallet: null,
          session: null,
          loading: false,
          error: null,
        });
        return;
      }

      const user = await mythical.auth.getUser();

      if (!user) {
        this.updateState({
          user: null,
          profile: null,
          polygonWallet: null,
          session,
          loading: false,
          error: null,
        });
        return;
      }

      const profile = user.profile ?? await mythical.profile.getOrCreate();
      let polygonWallet: LinkedWallet | null = null;

      try {
        polygonWallet = await getLinkedPolygonWallet();
      } catch (walletError) {
        console.warn('[AuthStateManager] Could not read linked Polygon wallet:', walletError);
      }

      this.updateState({
        user: { ...user, profile },
        profile,
        polygonWallet,
        session,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('[AuthStateManager] Play Hub auth refresh failed:', error);
      this.updateState({
        user: null,
        profile: null,
        polygonWallet: null,
        session: null,
        loading: false,
        error: error?.message || 'Could not load Play Hub session.',
      });
    }
  }

  async signInWithPlayHubEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Enter an email address.');
    }

    const cooldownUntil = this.currentState.magicLinkCooldownUntil;
    if (cooldownUntil && cooldownUntil > Date.now()) {
      const message = `Login link already sent. Check your email or try again in ${formatWaitTime(cooldownUntil - Date.now())}.`;
      this.updateState({ loading: false, error: message });
      throw new Error(message);
    }

    this.updateState({ loading: true, error: null });

    try {
      await mythical.auth.signInWithMagicLink(normalizedEmail, window.location.origin);
      const nextCooldownUntil = Date.now() + MAGIC_LINK_COOLDOWN_MS;
      persistMagicLinkCooldown(normalizedEmail, nextCooldownUntil);
      this.updateState({
        loading: false,
        error: null,
        magicLinkSentTo: normalizedEmail,
        magicLinkCooldownUntil: nextCooldownUntil,
      });
    } catch (error: any) {
      const rateLimited = isEmailRateLimitError(error);
      const nextCooldownUntil = rateLimited ? Date.now() + MAGIC_LINK_RATE_LIMIT_COOLDOWN_MS : null;
      const message = getAuthErrorMessage(error);

      if (nextCooldownUntil) {
        persistMagicLinkCooldown(this.currentState.magicLinkSentTo ?? normalizedEmail, nextCooldownUntil);
      }

      this.updateState({
        error: message,
        loading: false,
        magicLinkSentTo: this.currentState.magicLinkSentTo,
        magicLinkCooldownUntil: nextCooldownUntil ?? this.currentState.magicLinkCooldownUntil,
      });
      throw new Error(message);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.updateState({ loading: true, error: null });

    try {
      await signInWithGoogle();
    } catch (error: any) {
      const message = error?.message || 'Could not start Google sign-in.';
      this.updateState({ error: message, loading: false });
      throw new Error(message);
    }
  }

  async signInWithPolygonWallet(): Promise<LinkedWallet> {
    this.updateState({ loading: true, error: null });

    try {
      if (!PLAYHUB_ENABLE_WEB3_AUTH) {
        throw new Error('Polygon wallet sign-in is not enabled for this environment.');
      }
      if (!hasPolygonProvider()) {
        throw new Error('No Polygon wallet provider found. Install or unlock a browser wallet first.');
      }

      const wallet = await signInWithPolygonWeb3();
      await this.refreshAuthState();
      this.updateState({ polygonWallet: wallet, loading: false, error: null });
      return wallet;
    } catch (error: any) {
      const message = error?.message || 'Could not sign in with Polygon wallet.';
      this.updateState({ error: message, loading: false });
      throw new Error(message);
    }
  }

  async connectPolygonWallet(): Promise<LinkedWallet> {
    this.updateState({ loading: true, error: null });

    try {
      if (!hasPolygonProvider()) {
        throw new Error('No Polygon wallet provider found. Install or unlock a browser wallet first.');
      }

      await mythical.profile.getOrCreate();
      const wallet = await connectLinkedPolygonWallet();
      await this.refreshAuthState();
      this.updateState({ polygonWallet: wallet, loading: false, error: null });
      return wallet;
    } catch (error: any) {
      const message = error?.message || 'Could not link Polygon wallet.';
      this.updateState({ error: message, loading: false });
      throw new Error(message);
    }
  }

  async signOut(): Promise<void> {
    this.updateState({ loading: true, error: null, magicLinkSentTo: null, magicLinkCooldownUntil: null });
    persistMagicLinkCooldown(null, null);

    try {
      await mythical.auth.signOut();
      this.updateState({
        ...initialAuthState,
        loading: false,
        magicLinkSentTo: null,
        magicLinkCooldownUntil: null,
      });
    } catch (error: any) {
      console.error('[AuthStateManager] Sign out error:', error);
      this.updateState({ error: error.message, loading: false });
    }
  }
}

function getAuthStateManager(): AuthStateManager {
  if (!authStateManager) {
    authStateManager = new AuthStateManager();
  }
  return authStateManager;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);

  useEffect(() => {
    const manager = getAuthStateManager();
    const unsubscribe = manager.subscribe(setAuthState);
    
    return unsubscribe;
  }, []);

  const signInWithPlayHubEmail = async (email: string): Promise<void> => {
    const manager = getAuthStateManager();
    return manager.signInWithPlayHubEmail(email);
  };

  const signInWithGoogle = async (): Promise<void> => {
    const manager = getAuthStateManager();
    return manager.signInWithGoogle();
  };

  const signInWithPolygonWallet = async (): Promise<LinkedWallet> => {
    const manager = getAuthStateManager();
    return manager.signInWithPolygonWallet();
  };

  const connectPolygonWallet = async (): Promise<LinkedWallet> => {
    const manager = getAuthStateManager();
    return manager.connectPolygonWallet();
  };

  const refreshAuthState = async (): Promise<void> => {
    const manager = getAuthStateManager();
    return manager.refreshAuthState();
  };

  const signOut = async (): Promise<void> => {
    const manager = getAuthStateManager();
    return manager.signOut();
  };

  const value: AuthContextType = {
    ...authState,
    signInWithGoogle,
    signInWithPolygonWallet,
    signInWithPlayHubEmail,
    connectPolygonWallet,
    refreshAuthState,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
