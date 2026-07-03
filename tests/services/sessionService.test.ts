import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../../src/services/mythicalClient.js', () => ({
  mythical: {
    competition: {
      createSession: sessionMocks.createSession,
    },
  },
}));

vi.mock('../../src/utils/supabaseClient.js', () => ({
  PLAYHUB_COMPETITIVE_MODE_ID: 'competitive_gem',
  PLAYHUB_DEFAULT_STAKE_GEM: '5',
  PLAYHUB_GAME_ID: 'card_game',
  PLAYHUB_JOINABLE_SESSION_TTL_MS: 10 * 60 * 1000,
  PLAYHUB_MODE_ID: 'casual',
  PLAYHUB_WAITING_SESSION_TTL_MS: 60 * 60 * 1000,
  normalizeSession: (row: any, participants?: any[]) => ({
    id: row.session_id ?? row.id,
    code: row.session_code ?? row.code,
    status: row.session_status ?? row.status,
    game_id: row.game_id,
    mode_id: row.mode_id,
    host_id: row.host_id,
    min_players: row.min_players,
    max_players: row.max_players,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    participants,
    competition: row.competition,
  }),
  supabase: {
    from: sessionMocks.from,
    channel: vi.fn(),
  },
}));

vi.mock('../../src/services/gameStateService.js', () => ({
  getCardGameSessionState: vi.fn(),
}));

import { createCompetitiveSession, getAvailableGames } from '../../src/services/sessionService.js';

function createGameSessionsQuery(rows: any[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn(async () => ({ data: rows, error: null })),
  };
}

function createParticipantsQuery(participantsBySession: Record<string, any[]>) {
  let sessionId = '';
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: string) => {
      if (column === 'session_id') sessionId = value;
      return query;
    }),
    order: vi.fn(async () => ({ data: participantsBySession[sessionId] ?? [], error: null })),
  };
  return query;
}

describe('sessionService competitive GEM sessions', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionMocks.createSession.mockResolvedValue({
      session_id: 'session-1',
      session_code: 'ABCD',
      session_status: 'waiting',
      game_id: 'card_game',
      mode_id: 'competitive_gem',
      host_id: 'profile-1',
      min_players: 2,
      max_players: 2,
      created_at: '2026-01-01T00:00:00Z',
    });
  });

  it('normalizes and forwards whole GEM stakes to the SDK', async () => {
    const session = await createCompetitiveSession(' 50 ');

    expect(sessionMocks.createSession).toHaveBeenCalledWith({ stakeGem: '50' });
    expect(session).toMatchObject({
      id: 'session-1',
      code: 'ABCD',
      mode_id: 'competitive_gem',
    });
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects invalid GEM stake %s before calling the backend', async (stake) => {
    await expect(createCompetitiveSession(stake)).rejects.toThrow('GEM stake must be a positive whole number');

    expect(sessionMocks.createSession).not.toHaveBeenCalled();
  });

  it('hides stale and full sessions that the current player cannot join', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:15:00Z'));

    const rows = [
      {
        id: 'fresh-open',
        code: 'FRESH1',
        status: 'waiting',
        game_id: 'card_game',
        mode_id: 'casual',
        host_id: 'host-1',
        min_players: 2,
        max_players: 2,
        created_at: '2026-01-01T00:10:00Z',
      },
      {
        id: 'fresh-full-other',
        code: 'FULL01',
        status: 'waiting',
        game_id: 'card_game',
        mode_id: 'casual',
        host_id: 'host-2',
        min_players: 2,
        max_players: 2,
        created_at: '2026-01-01T00:14:00Z',
      },
      {
        id: 'stale-open',
        code: 'STALE1',
        status: 'waiting',
        game_id: 'card_game',
        mode_id: 'casual',
        host_id: 'host-3',
        min_players: 2,
        max_players: 2,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'own-waiting',
        code: 'OWN001',
        status: 'waiting',
        game_id: 'card_game',
        mode_id: 'casual',
        host_id: 'host-4',
        min_players: 2,
        max_players: 2,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const participants = {
      'fresh-open': [{ session_id: 'fresh-open', player_id: 'host-1', slot: 0, is_ready: true }],
      'fresh-full-other': [
        { session_id: 'fresh-full-other', player_id: 'host-2', slot: 0, is_ready: true },
        { session_id: 'fresh-full-other', player_id: 'other-player', slot: 1, is_ready: false },
      ],
      'stale-open': [{ session_id: 'stale-open', player_id: 'host-3', slot: 0, is_ready: true }],
      'own-waiting': [
        { session_id: 'own-waiting', player_id: 'host-4', slot: 0, is_ready: true },
        { session_id: 'own-waiting', player_id: 'profile-1', slot: 1, is_ready: false },
      ],
    };

    sessionMocks.from.mockImplementation((table: string) => {
      if (table === 'game_sessions') return createGameSessionsQuery(rows);
      if (table === 'session_participants') return createParticipantsQuery(participants);
      throw new Error(`Unexpected table ${table}`);
    });

    const sessions = await getAvailableGames('casual', 'profile-1');

    expect(sessions.map((session) => session.id)).toEqual(['fresh-open', 'own-waiting']);
  });
});
