import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { describeBoardMotion, describeMotion, duelId, duelMotion, type DuelView } from '../utils/trainingMotion.js';
import { playDuelMotion, snapshotBoard } from '../utils/duelMotionPlayer.js';
import { motionSounds } from '../audio/motionSound.js';
import type { SoundPresentation } from '../audio/trainingAudio.js';

export interface EffectEntry {
  turn: number;
  lines: string[];
}

export function useTrainingMotion(
  game: DuelView,
  root: RefObject<HTMLDivElement | null>,
  layer: RefObject<HTMLDivElement | null>,
  layoutKey: string,
  paused: boolean,
  sound?: SoundPresentation,
  showPendingChoice = true,
  viewer = game.players[0].id,
) {
  const previous = useRef(game);
  const before = useRef<ReturnType<typeof snapshotBoard>>(new Map());
  const player = useRef<ReturnType<typeof playDuelMotion> | null>(null);
  const audio = useRef(sound);
  audio.current = sound;
  const [announcement, setAnnouncement] = useState('');
  const [caption, setCaption] = useState<string | null>(null);
  const [history, setHistory] = useState<EffectEntry[]>([]);
  const [presenting, setPresenting] = useState(false);
  const capture = useCallback(() => {
    before.current = snapshotBoard(root.current);
  }, [root]);
  const finish = useCallback(() => {
    player.current?.cancel();
    player.current = null;
    audio.current?.stopEffects();
    setCaption(null);
    setPresenting(false);
  }, []);
  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reset = () => {
      finish();
      capture();
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('resize', reset);
    window.addEventListener('scroll', reset, true);
    document.addEventListener('visibilitychange', visibility);
    media?.addEventListener('change', reset);
    return () => {
      finish();
      window.removeEventListener('resize', reset);
      window.removeEventListener('scroll', reset, true);
      document.removeEventListener('visibilitychange', visibility);
      media?.removeEventListener('change', reset);
    };
  }, [capture, finish]);
  useLayoutEffect(() => {
    finish();
    capture();
  }, [layoutKey, paused, finish, capture]);

  useLayoutEffect(() => {
    const last = previous.current;
    // A clock poll or duplicate acknowledgement is not a new move.
    if (
      'events' in game &&
      'events' in last &&
      game.matchId === last.matchId &&
      game.stateVersion <= last.stateVersion
    ) {
      if (!before.current.size) capture();
      return;
    }
    if (duelId(last) !== duelId(game)) {
      finish();
      setHistory([]);
      setAnnouncement('');
    }
    const steps = duelMotion(last, game, showPendingChoice);
    previous.current = game;
    const old = before.current;
    const next = snapshotBoard(root.current);
    before.current = next;
    if (!steps.length) return;
    const visible = (anchor: string) => old.has(anchor) || next.has(anchor);
    const lines = steps.map((step) => describeBoardMotion(step, viewer, visible));
    setAnnouncement(lines.join('. '));
    if (!('events' in game)) setHistory((entries) => [...entries, { turn: game.turn, lines }]);
    if (paused || document.hidden) return;
    if (player.current) finish();
    if (!layer.current || typeof layer.current.animate !== 'function') {
      steps.flatMap(motionSounds).forEach((cue) => audio.current?.play(cue));
      return;
    }
    const playback = playDuelMotion(layer.current, old, next, steps, audio.current, (index, preview, targets) => {
      setCaption(
        preview === undefined ? lines[index] : describeBoardMotion(steps[index], viewer, visible, preview, targets),
      );
    });
    player.current = playback;
    setPresenting(true);
    void playback.finished
      .catch(() => {})
      .finally(() => {
        if (player.current !== playback) return;
        player.current = null;
        setCaption(null);
        setPresenting(false);
      });
  }, [game, root, layer, showPendingChoice, paused, capture, finish, viewer]);
  const lastEvent = 'events' in game ? game.events.at(-1) : undefined;
  const current = caption ?? announcement;
  const summary = current || lastEvent?.cues?.map((cue) => describeMotion(cue, viewer)).join('. ') || '';
  return { capture, announcement: current, summary, history, presenting, finish };
}
