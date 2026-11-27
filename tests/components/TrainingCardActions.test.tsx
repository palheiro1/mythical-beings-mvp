import { useReducer } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrainingBoard from '../../src/components/training/TrainingBoard.js';
import { createTrainingSession, trainingSessionReducer } from '../../src/game/trainingSession.js';
import { GUIDED_TEAM } from '../../src/utils/trainingMode.js';

describe('direct creature actions', () => {
  it('names an occupied knowledge before replacing it and keeps the inspect control harmless', () => {
    const initial = createTrainingSession(GUIDED_TEAM, 'guided', 'mobile-replacement');
    initial.guide = 'free';
    const previous = initial.game.market.find(card => card.name === 'Blue Sky')!;
    const next = initial.game.market.find(card => card.name === 'Lepidoptera')!;
    initial.game.market = initial.game.market.filter(card => card !== previous && card !== next);
    initial.game.players[0].creatures[0].rotation = 90;
    initial.game.players[0].creatures[0].currentWisdom = 2;
    initial.game.players[0].field[0].knowledge = previous;
    initial.game.players[0].hand = [next];
    initial.selectedId = next.instanceId!;
    const inspect = vi.fn();
    function Board() {
      const [session, dispatch] = useReducer(trainingSessionReducer, initial);
      return <><TrainingBoard direct session={session} onAction={action => dispatch({ type:'play', action })} onInspect={inspect} />
        <output aria-label="Attached knowledge">{session.game.players[0].field[0].knowledge?.name}</output>
        <output aria-label="Actions taken">{session.game.actionsTakenThisTurn}</output></>;
    }
    render(<Board />);
    const play = screen.getByRole('button', { name:'Play Lepidoptera on Tarasca, replacing Blue Sky', exact:true });
    expect(play).toHaveClass('wd-card-art','is-highlighted');
    const details = screen.getByRole('button', { name:'Inspect Tarasca', exact:true });
    expect(within(details).getByText('Replaces Blue Sky')).toBeInTheDocument();
    expect(within(play).queryByText('Replaces Blue Sky')).not.toBeInTheDocument();
    fireEvent.click(details);
    expect(inspect).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Attached knowledge')).toHaveTextContent('Blue Sky');
    expect(screen.getByLabelText('Actions taken')).toHaveTextContent('0');
    fireEvent.click(within(play).getByRole('img', { name:'Tarasca' }));
    expect(screen.getByLabelText('Attached knowledge')).toHaveTextContent('Lepidoptera');
    expect(screen.getByLabelText('Actions taken')).toHaveTextContent('1');
    expect(screen.queryByText('Replaces Blue Sky')).not.toBeInTheDocument();
  });
});
