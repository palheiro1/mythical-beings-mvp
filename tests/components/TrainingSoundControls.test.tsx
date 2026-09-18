import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TrainingSoundControls from '../../src/components/training/TrainingSoundControls.js';
import { DEFAULT_AUDIO } from '../../src/audio/trainingAudio.js';

describe('sound controls', () => {
  it('offers independent named sliders and keeps keyboard focus inside the panel', async () => {
    const user = userEvent.setup(); const update = vi.fn(); const play = vi.fn(); const onClose = vi.fn();
    render(<TrainingSoundControls preferences={{ ...DEFAULT_AUDIO, enabled: true }} update={update} play={play} error="" open onOpen={vi.fn()} onClose={onClose} />);
    const music = screen.getByRole('slider', { name: 'Music volume' });
    const effects = screen.getByRole('slider', { name: 'Effects volume' });
    fireEvent.change(music, { target: { value: '15' } });
    expect(update).toHaveBeenLastCalledWith({ music: 0.15 });
    fireEvent.change(effects, { target: { value: '80' } });
    expect(update).toHaveBeenLastCalledWith({ effects: 0.8 });
    await user.click(screen.getByRole('button', { name: 'Damage', exact: true }));
    expect(play).toHaveBeenCalledWith({ kind: 'damage', amount: 4 });
    music.focus(); await user.tab(); expect(effects).toHaveFocus();
    screen.getByRole('button', { name: 'Fire', exact: true }).focus();
    await user.tab(); expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.keyboard('{Escape}'); expect(onClose).toHaveBeenCalled();
  });
  it('disables sound samples while muted and enables sound only explicitly', async () => {
    const user = userEvent.setup(); const update = vi.fn();
    render(<TrainingSoundControls preferences={DEFAULT_AUDIO} update={update} play={vi.fn()} error="" open={false} onOpen={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Enable sound' }));
    expect(update).toHaveBeenCalledWith({ enabled: true });
  });
});
