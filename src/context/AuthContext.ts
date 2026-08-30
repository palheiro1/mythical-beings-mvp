import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { LinkedWallet, PlayHubProfile, PlayHubUser } from '@mythicalb/sdk';

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

export interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithPlayHubEmail: (email: string) => Promise<void>;
  connectPolygonWallet: () => Promise<LinkedWallet>;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
