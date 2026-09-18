import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_PREFERENCES_KEY, readAudioPreferences, TrainingAudio, type AudioPreferences, type TrainingSound } from '../audio/trainingAudio.js';

export function useTrainingAudio(paused: boolean) {
  const [preferences, setPreferences] = useState(readAudioPreferences);
  const preferencesRef = useRef(preferences);
  const engine = useRef<TrainingAudio | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const audio = new TrainingAudio(setError); engine.current = audio;
    audio.configure(preferencesRef.current);
    return () => { audio.dispose(); engine.current = null; };
  }, []);
  useEffect(() => {
    const visibility = () => engine.current?.setSuspended(paused || document.hidden);
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [paused]);
  const unlock = useCallback(() => {
    if (preferencesRef.current.enabled) void engine.current?.unlock();
  }, []);
  const update = useCallback((patch: Partial<AudioPreferences>) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next; setPreferences(next); setError('');
    try { localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(next)); } catch { /* Preferences are optional. */ }
    engine.current?.configure(next);
    if (next.enabled) void engine.current?.unlock();
  }, []);
  const presentation = useMemo(() => ({
    play: (sound: TrainingSound) => engine.current?.play(sound),
    stopEffects: () => engine.current?.stopEffects(),
  }), []);
  return { preferences, update, error, unlock, presentation };
}
