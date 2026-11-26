import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { COMPETITIVE_CATALOG, initializeCompetitiveMatch, projectMatch } from '@mythicalb/wisdom-duel-engine';
import type { CompetitiveProjection } from '@mythicalb/wisdom-duel-engine';
import ChallengeArena from '../../src/components/competition/ChallengeArena.js';
import { effectScenario, resolveScenario } from '../browser/duelEffectScenarios.js';

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
    lobbyPath="/challenge?period=fixture" sending={false} retryable={false} error="" send={send} /></MemoryRouter>);
  return send;
}

describe('weekly challenge arena', () => {
  it('draws one pointer only while aiming and sends the matching Tulpar choice from the board', async () => {
    const match = resolveScenario('Tulpar', await effectScenario('Tulpar', now), now);
    const projection = projectMatch(match, 'north', now);
    const send = page(projection, 'north');
    const options = screen.getByRole('region', { name: 'Resolve the card effect' });
    const adaro = within(options).getByRole('button', { name: 'Adaro' });
    const kappa = document.querySelector<HTMLElement>('[data-motion-anchor="creature:north:kappa"]')!;
    const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      const left = this.dataset.motionAnchor?.endsWith(':tulpar') ? 310 : this.dataset.motionAnchor?.endsWith(':kappa') ? 170 : 30;
      return new DOMRect(left, 100, 64, 90);
    });
    try {
      expect(document.querySelector('.wd-choice-pointer')).toBeNull();
      act(() => adaro.focus());
      const adaroPath = document.querySelector('.wd-choice-shaft')?.getAttribute('d');
      expect(adaroPath).toMatch(/^M /);
      fireEvent.pointerOver(kappa);
      expect(document.querySelectorAll('.wd-choice-pointer')).toHaveLength(1);
      expect(document.querySelector('.wd-choice-shaft')?.getAttribute('d')).not.toBe(adaroPath);
      fireEvent.pointerOut(kappa);
      expect(document.querySelector('.wd-choice-pointer')).toBeNull();
      fireEvent.pointerDown(kappa);
      expect(document.querySelector('.wd-choice-pointer')).toBeInTheDocument();
      fireEvent.click(kappa);
      expect(send).toHaveBeenCalledExactlyOnceWith({
        type: 'resolve_pending_effect', effectId: projection.pendingEffect!.id, choiceKey: projection.pendingEffect!.choices[1].key,
      });
      expect(document.querySelector('.wd-choice-pointer')).toBeNull();
    } finally {
      rects.mockRestore();
    }
  });

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
