import { SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import type { AudioPreferences, TrainingSound } from '../../audio/trainingAudio.js';
import TrainingDialog from './TrainingDialog.js';

const samples: { label: string; sound: TrainingSound }[] = [
  { label: 'Card', sound: { kind: 'place', element: 'neutral' } },
  { label: 'Rotation', sound: { kind: 'rotate' } },
  { label: 'Damage', sound: { kind: 'damage', amount: 4 } },
  { label: 'Defense', sound: { kind: 'block' } },
  { label: 'Water', sound: { kind: 'effect', element: 'water' } },
  { label: 'Earth', sound: { kind: 'effect', element: 'earth' } },
  { label: 'Air', sound: { kind: 'effect', element: 'air' } },
  { label: 'Fire', sound: { kind: 'effect', element: 'fire' } },
];

export default function TrainingSoundControls({ preferences, update, error, play, open, onOpen, onClose }: {
  preferences: AudioPreferences; update: (patch: Partial<AudioPreferences>) => void; error: string; play: (sound: TrainingSound) => void;
  open: boolean; onOpen: () => void; onClose: () => void;
}) {
  return <div className="wd-sound-controls">
    <button className="wd-icon-button" aria-label={preferences.enabled ? 'Mute sound' : 'Enable sound'} aria-pressed={preferences.enabled} title={preferences.enabled ? 'Mute sound' : 'Enable sound'} onClick={() => update({ enabled: !preferences.enabled })}>
      {preferences.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
    <button className="wd-icon-button wd-sound-settings" aria-label="Sound settings" title="Sound settings" onClick={onOpen}><SlidersHorizontal size={15} /></button>
    {open && <TrainingDialog title="Sound of the Confluence" onClose={onClose}>
      <p>An epic instrumental score and elemental card effects.</p>
      <div className="wd-sound-panel">
        <button className="wd-button" aria-pressed={preferences.enabled} onClick={() => update({ enabled: !preferences.enabled })}>{preferences.enabled ? 'Mute all sound' : 'Enable sound'}</button>
        <label>Music <output>{Math.round(preferences.music * 100)}%</output><input aria-label="Music volume" type="range" min="0" max="100" step="1" value={Math.round(preferences.music * 100)} onChange={event => update({ music: Number(event.target.value) / 100 })} /></label>
        <label>Effects <output>{Math.round(preferences.effects * 100)}%</output><input aria-label="Effects volume" type="range" min="0" max="100" step="1" value={Math.round(preferences.effects * 100)} onChange={event => update({ effects: Number(event.target.value) / 100 })} /></label>
        <p className="wd-caption">Try the sounds, then return to the table. Your volume choices are remembered.</p>
        <div className="wd-sound-samples">{samples.map(({ label, sound }) => <button key={label} className="wd-button" disabled={!preferences.enabled || !preferences.effects} onClick={() => play(sound)}>{label}</button>)}</div>
        {error && <p role="status">{error}</p>}
      </div>
    </TrainingDialog>}
    {error && !open && <span className="sr-only" role="status">{error}</span>}
  </div>;
}
