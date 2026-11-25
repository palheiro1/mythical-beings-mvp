import type { PropsWithChildren } from 'react';
import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlayerProfiles } from '../../src/hooks/usePlayerProfiles.js';
import type { ProfileInfo } from '../../src/utils/supabaseClient.js';

const profile = (id: string, name = id): ProfileInfo => ({
  id,
  username: name,
  display_name: name,
  avatar_url: null,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const strictWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;

describe('usePlayerProfiles', () => {
  it('mirrors upstream loading and does not start profile requests early', () => {
    const loadProfile = vi.fn(async (id: string) => profile(id));
    const { result } = renderHook(() => usePlayerProfiles({
      playerIds: ['player-one', 'player-two'],
      upstreamLoading: true,
      loadProfile,
    }));

    expect(result.current).toEqual({ profiles: {}, loading: true });
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('deduplicates in-flight profile loads under Strict Mode', async () => {
    const pending = new Map([
      ['player-one', deferred<ProfileInfo | null>()],
      ['player-two', deferred<ProfileInfo | null>()],
    ]);
    const loadProfile = vi.fn((id: string) => pending.get(id)!.promise);
    const { result } = renderHook(() => usePlayerProfiles({
      playerIds: ['player-one', 'player-two'],
      upstreamLoading: false,
      loadProfile,
    }), { wrapper: strictWrapper });
    await waitFor(() => expect(loadProfile).toHaveBeenCalledTimes(2));

    await act(async () => {
      pending.get('player-one')!.resolve(profile('player-one', 'One'));
      pending.get('player-two')!.resolve(profile('player-two', 'Two'));
      await Promise.all([...pending.values()].map((entry) => entry.promise));
    });

    await waitFor(() => expect(result.current).toMatchObject({
      loading: false,
      profiles: {
        'player-one': { display_name: 'One' },
        'player-two': { display_name: 'Two' },
      },
    }));
    expect(loadProfile).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale pair that resolves after player IDs change', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<ProfileInfo | null>>>();
    const loadProfile = vi.fn((id: string) => {
      const request = deferred<ProfileInfo | null>();
      pending.set(id, request);
      return request.promise;
    });
    const { result, rerender } = renderHook(
      ({ ids }) => usePlayerProfiles({
        playerIds: ids,
        upstreamLoading: false,
        loadProfile,
      }),
      { initialProps: { ids: ['old-one', 'old-two'] as const } },
    );
    await waitFor(() => expect(loadProfile).toHaveBeenCalledTimes(2));
    rerender({ ids: ['new-one', 'new-two'] as const });
    await waitFor(() => expect(loadProfile).toHaveBeenCalledTimes(4));

    await act(async () => {
      pending.get('old-one')!.resolve(profile('old-one'));
      pending.get('old-two')!.resolve(profile('old-two'));
      await Promise.resolve();
    });
    expect(result.current.profiles).toEqual({});
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.get('new-one')!.resolve(profile('new-one'));
      pending.get('new-two')!.resolve(profile('new-two'));
      await Promise.resolve();
    });
    await waitFor(() => expect(Object.keys(result.current.profiles).sort()).toEqual([
      'new-one',
      'new-two',
    ]));
  });

  it('normalizes a partial failure and finishes loading', async () => {
    const loadProfile = vi.fn(async (id: string) => {
      if (id === 'player-two') throw new Error('profile service failed');
      return profile(id, 'Player One');
    });
    const { result } = renderHook(() => usePlayerProfiles({
      playerIds: ['player-one', 'player-two'],
      upstreamLoading: false,
      loadProfile,
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profiles).toEqual({
      'player-one': { ...profile('player-one', 'Player One'), is_guest: null },
      'player-two': {
        id: 'player-two',
        username: null,
        display_name: null,
        avatar_url: null,
      },
    });
  });

  it('reuses cached profiles when returning to a previous pair', async () => {
    const loadProfile = vi.fn(async (id: string) => profile(id));
    const { result, rerender } = renderHook(
      ({ ids }) => usePlayerProfiles({
        playerIds: ids,
        upstreamLoading: false,
        loadProfile,
      }),
      { initialProps: { ids: ['first-one', 'first-two'] as const } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ ids: ['second-one', 'second-two'] as const });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadProfile).toHaveBeenCalledTimes(4);

    rerender({ ids: ['first-one', 'first-two'] as const });
    await waitFor(() => expect(Object.keys(result.current.profiles).sort()).toEqual([
      'first-one',
      'first-two',
    ]));
    expect(loadProfile).toHaveBeenCalledTimes(4);
  });
});
