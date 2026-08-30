import { useEffect, useRef, useState } from 'react';
import { getProfile } from '../services/profileService.js';
import type { ProfileInfo } from '../utils/supabaseClient.js';

export type ProfilesById = Record<string, ProfileInfo>;

export interface UsePlayerProfilesOptions {
  playerIds: readonly [string | null | undefined, string | null | undefined];
  upstreamLoading: boolean;
  loadProfile?: (playerId: string) => Promise<ProfileInfo | null>;
}

export interface UsePlayerProfilesResult {
  profiles: ProfilesById;
  loading: boolean;
}

type ProfileLoadState = {
  key: string | null;
  profiles: ProfilesById;
  loading: boolean;
};

const emptyProfile = (playerId: string): ProfileInfo => ({
  id: playerId,
  username: null,
  display_name: null,
  avatar_url: null,
});

const normalizeLoadedProfile = (
  playerId: string,
  profile: ProfileInfo | null,
): ProfileInfo => ({
  id: playerId,
  username: profile?.username || null,
  display_name: profile?.display_name || null,
  avatar_url: profile?.avatar_url || null,
  is_guest: profile?.is_guest ?? null,
});

export function usePlayerProfiles(options: UsePlayerProfilesOptions): UsePlayerProfilesResult {
  const playerOneId = options.playerIds[0] || null;
  const playerTwoId = options.playerIds[1] || null;
  const upstreamLoading = options.upstreamLoading;
  const loadProfile = options.loadProfile ?? getProfile;
  const cacheRef = useRef(new Map<string, ProfileInfo>());
  const inFlightRef = useRef(new Map<string, Promise<ProfileInfo>>());
  const [loadState, setLoadState] = useState<ProfileLoadState>({
    key: null,
    profiles: {},
    loading: false,
  });

  const validIds = Boolean(playerOneId && playerTwoId);
  const requestKey = validIds ? `${playerOneId}\u0000${playerTwoId}` : null;

  useEffect(() => {
    if (upstreamLoading) {
      setLoadState({ key: null, profiles: {}, loading: false });
      return undefined;
    }
    if (!playerOneId || !playerTwoId || !requestKey) {
      setLoadState({ key: null, profiles: {}, loading: false });
      return undefined;
    }

    let active = true;
    const ids: [string, string] = [playerOneId, playerTwoId];
    const fromCache = ids.every((playerId) => cacheRef.current.has(playerId));
    if (fromCache) {
      const profiles = Object.fromEntries(ids.map((playerId) => [
        playerId,
        cacheRef.current.get(playerId)!,
      ]));
      setLoadState({ key: requestKey, profiles, loading: false });
      return () => { active = false; };
    }

    setLoadState({ key: requestKey, profiles: {}, loading: true });
    const loadOne = (playerId: string): Promise<ProfileInfo> => {
      const cached = cacheRef.current.get(playerId);
      if (cached) return Promise.resolve(cached);
      const existing = inFlightRef.current.get(playerId);
      if (existing) return existing;

      const pending = Promise.resolve()
        .then(() => loadProfile(playerId))
        .then(
          (profile) => normalizeLoadedProfile(playerId, profile),
          () => emptyProfile(playerId),
        )
        .then((profile) => {
          cacheRef.current.set(playerId, profile);
          return profile;
        });
      inFlightRef.current.set(playerId, pending);
      void pending.finally(() => {
        if (inFlightRef.current.get(playerId) === pending) {
          inFlightRef.current.delete(playerId);
        }
      });
      return pending;
    };

    void Promise.all(ids.map(loadOne)).then((profiles) => {
      if (!active) return;
      setLoadState({
        key: requestKey,
        profiles: Object.fromEntries(ids.map((playerId, index) => [playerId, profiles[index]])),
        loading: false,
      });
    });

    return () => { active = false; };
  }, [loadProfile, playerOneId, playerTwoId, requestKey, upstreamLoading]);

  if (upstreamLoading) return { profiles: {}, loading: true };
  if (!requestKey) return { profiles: {}, loading: false };
  if (loadState.key !== requestKey) return { profiles: {}, loading: true };
  return { profiles: loadState.profiles, loading: loadState.loading };
}
