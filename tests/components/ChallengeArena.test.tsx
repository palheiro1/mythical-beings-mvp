import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { COMPETITIVE_CATALOG, initializeCompetitiveMatch, projectMatch } from '@mythicalb/wisdom-duel-engine';
import type { CompetitiveProjection } from '@mythicalb/wisdom-duel-engine';
import ChallengeArena from '../../src/components/competition/ChallengeArena.js';

const matchId = 'a1f2d04c-5d42-4536-981b-0f23451791b8';
const now = '2026-11-09T13:00:00.000Z';

async function fixture() {
  const team = COMPETITIVE_CATALOG.slice(0, 3);
  const snapshot = await initializeCompetitiveMatch({
    matchId, mode: 'casual', players: ['a', 'b'], selections: [team, team], seedHex: '2e'.repeat(32), now,
  });
  const actor = snapshot.state.players[snapshot.state.currentPlayerIndex].id;
  return { actor, projection: projectMatch(snapshot, actor, now) };
}

function page(projection: CompetitiveProjection, actor: string) {
  const send = vi.fn().mockResolvedValue('accepted');
  render(<MemoryRouter><ChallengeArena projection={projection} playerId={actor}
    standingsPath="/challenge?period=fixture" sending={false} retryable={false} error="" send={send} /></MemoryRouter>);
  return send;
}

describe('weekly challenge arena', () => {
  it('shows the shared arena and turns market and turn controls into authoritative commands', async () => {
    const { actor, projection } = await fixture();
    const send = page(projection, actor);
    expect(screen.getByRole('region', { name: 'Duel board' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your Power: 20')).toBeInTheDocument();
    expect(screen.getByLabelText('Opponent’s clock: 10:00')).toBeInTheDocument();
    const [card] = projection.market;
    fireEvent.click(within(screen.getByRole('region', { name: 'Market' })).getAllByRole('button', { name: `Draw ${card.name}` })[0]);
    expect(send).toHaveBeenCalledWith({ type: 'draw_knowledge', marketInstanceId: card.instanceId });
    fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
    expect(send).toHaveBeenCalledWith({ type: 'end_turn' });
  });

  it('opens the stored timeout result with links to the edition and replay', async () => {
    const { actor, projection } = await fixture();
    const rival = projection.players.find(player => player.id !== actor)!;
    const send = page({
      ...projection, phase: 'gameOver', decisionPlayerId: null,
      outcome: { reason: 'timeout', winnerId: rival.id, finishedAt: now },
    }, actor);
    const result = screen.getByRole('dialog', { name: 'Defeat' });
    expect(within(result).getByText(/ran out of time/)).toBeInTheDocument();
    expect(within(result).getByRole('link', { name: 'Standings' })).toHaveAttribute('href', '/challenge?period=fixture');
    expect(within(result).getByRole('link', { name: 'View full replay' })).toHaveAttribute('href', `/replay/${matchId}`);
    expect(screen.getByRole('button', { name: 'View Result' })).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });
});
