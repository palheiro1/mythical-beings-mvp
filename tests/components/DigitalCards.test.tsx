import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DigitalCardFace from '../../src/components/DigitalCardFace.js';
import TrainingCard from '../../src/components/training/TrainingCard.js';
import CardDetailOverlay from '../../src/components/CardDetailOverlay.js';
import creatures from '../../src/assets/creatures.json';
import knowledges from '../../src/assets/knowledges.json';
import { getCardPresentation, type DisplayCard } from '../../src/utils/digitalCards.js';
import type { Creature, Knowledge } from '../../src/game/types.js';
import { createTrainingSession } from '../../src/game/trainingSession.js';
import { GUIDED_TEAM } from '../../src/utils/trainingMode.js';
import { getPendingEffectCard } from '../../src/utils/pendingEffectCard.js';

const kappa = creatures.find(card => card.id === 'kappa') as Creature;
const asteroid = knowledges.find(card => card.id === 'aquatic2') as Knowledge;

describe('digital card information', () => {
  it('keeps cost separate from the changing attack/defense cycle', () => {
    const { rerender } = render(<DigitalCardFace card={asteroid} variant="detail" />);
    expect(screen.getByLabelText('Cost 2')).toBeInTheDocument();
    expect(screen.getByLabelText('0 degrees: Defense 1')).toHaveAttribute('aria-current', 'step');
    rerender(<DigitalCardFace card={asteroid} rotation={90} variant="detail" />);
    expect(screen.getByLabelText('Cost 2')).toBeInTheDocument();
    expect(screen.getByLabelText('90 degrees: Damage 1')).toHaveAttribute('aria-current', 'step');
    rerender(<DigitalCardFace card={asteroid} rotation={270} variant="detail" />);
    expect(screen.getByText('Final rotation')).toBeInTheDocument();
  });

  it('shows effective Wisdom while keeping the unmodified rotation cycle visible', () => {
    render(<DigitalCardFace card={{ ...kappa, rotation: 180, currentWisdom: 5 }} variant="detail" />);
    expect(screen.getByLabelText('Wisdom 5')).toBeInTheDocument();
    expect(screen.getByLabelText('180 degrees: Wisdom 4')).toHaveAttribute('aria-current', 'step');
  });

  it('preserves the inspected game state without a decorative opponent rotation', () => {
    const inspect = vi.fn();
    render(<TrainingCard card={{ ...kappa, rotation: 90, currentWisdom: 2 }} onInspect={inspect} board />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Kappa' }));
    expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ rotation: 90, currentWisdom: 2 }));
  });

  it('shows power, limits and variable damage correctly when there is no numeric valueCycle', () => {
    const card = (id: string) => knowledges.find(item => item.id === id) as Knowledge;
    expect(getCardPresentation(card('aerial2'), 180).current).toMatchObject({ kind: 'power', value: 3 });
    expect(getCardPresentation(card('terrestrial4'), 90).current).toMatchObject({ kind: 'limit', value: 1 });
    expect(getCardPresentation(card('terrestrial3')).current).toMatchObject({ kind: 'damage', value: 'W' });
    expect(getCardPresentation(card('aquatic1')).cycle).toHaveLength(1);
    expect(getCardPresentation(card('aquatic3')).cycle).toHaveLength(2);
  });

  it('keeps live rotation and Wisdom bonuses in effect target choices', () => {
    const { game } = createTrainingSession(GUIDED_TEAM, 'guided', 'card-target-review');
    game.players[0].creatures[0] = { ...kappa, rotation: 180, currentWisdom: 4 };
    game.players[0].field[0] = { creatureId: kappa.id, knowledge: { ...(knowledges.find(card => card.id === 'aerial3') as Knowledge), instanceId: 'owl', rotation: 90 } };
    const creature = getPendingEffectCard(game, { kind: 'creature', playerIndex: 0, creatureId: kappa.id, label: 'Kappa' });
    expect(creature).toMatchObject({ rotation: 180, currentWisdom: 5 });
    const knowledge = getPendingEffectCard(game, { kind: 'knowledge', playerIndex: 0, creatureId: kappa.id, instanceId: 'owl', label: 'Owl' });
    expect(knowledge).toMatchObject({ instanceId: 'owl', rotation: 90 });
  });

  it('renders all 30 cards with their original names, art and complete rotation tracks', () => {
    const cards = [...creatures, ...knowledges] as DisplayCard[];
    expect(cards).toHaveLength(30);
    const { container } = render(<>{cards.map(card => <DigitalCardFace key={card.id} card={card} variant="detail" />)}</>);
    cards.forEach(card => {
      const face = container.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement;
      expect(within(face).getByRole('img', { name: card.name })).toBeInTheDocument();
      expect(within(face).getByLabelText('Rotation cycle').children).toHaveLength(getCardPresentation(card).cycle.length);
    });
  });

  it('does not reveal the face, name, art or rules of a hidden card in inspection', () => {
    render(<CardDetailOverlay card={asteroid} open showBack onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Hidden card' })).toBeInTheDocument();
    expect(screen.queryByText('Asteroid')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Asteroid' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cost 2')).not.toBeInTheDocument();
  });
});
