import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
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
  PLAYHUB_GAME_ID: 'card_game',
  PLAYHUB_MODE_ID: 'casual',
  PLAYHUB_STAKE_TIERS_GEM: ['5', '10', '25'],
  normalizeSession: (row: any) => ({
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
    competition: row.competition,
  }),
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
  },
}));

vi.mock('../../src/services/gameStateService.js', () => ({
  getCardGameSessionState: vi.fn(),
}));

import { createCompetitiveSession } from '../../src/services/sessionService.js';

describe('sessionService competitive GEM sessions', () => {
  beforeEach(() => {
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

  it('normalizes and forwards supported GEM stake tiers to the SDK', async () => {
    const session = await createCompetitiveSession(' 10 ');

    expect(sessionMocks.createSession).toHaveBeenCalledWith({ stakeGem: '10' });
    expect(session).toMatchObject({
      id: 'session-1',
      code: 'ABCD',
      mode_id: 'competitive_gem',
    });
  });

  it('rejects unsupported GEM stake tiers before calling the backend', async () => {
    await expect(createCompetitiveSession('50')).rejects.toThrow('Unsupported GEM stake tier');

    expect(sessionMocks.createSession).not.toHaveBeenCalled();
  });
});
