import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_PREFERENCES_KEY, DEFAULT_AUDIO, readAudioPreferences, TrainingAudio } from '../../src/audio/trainingAudio.js';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
const contexts: FakeContext[] = [];
const players: FakePlayer[] = [];
class FakePlayer {
  paused = true; loop = false; preload = ''; onerror: (() => void) | null = null;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn(); removeAttribute = vi.fn();
  constructor(public src: string) { players.push(this); }
}
class FakeContext {
  state = 'suspended'; currentTime = 0; sampleRate = 100; destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createGain = () => ({ gain: param(), connect: vi.fn() });
  createDynamicsCompressor = () => ({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: vi.fn() });
  createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
  constructor() { contexts.push(this); }
}
beforeEach(() => { localStorage.clear(); contexts.length = 0; players.length = 0; vi.stubGlobal('AudioContext', FakeContext); vi.stubGlobal('Audio', FakePlayer); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe('match audio lifecycle', () => {
  it('stays silent and makes no media/context until explicitly unlocked', () => {
    const audio = new TrainingAudio();
    audio.configure(DEFAULT_AUDIO); audio.play({ kind: 'damage' });
    expect(contexts).toHaveLength(0); expect(players).toHaveLength(0);
    audio.dispose();
  });
  it('reuses a single context/player and pauses/resumes without restarting the track', async () => {
    const audio = new TrainingAudio();
    audio.configure({ ...DEFAULT_AUDIO, enabled: true });
    await audio.unlock(); await audio.unlock();
    expect(contexts).toHaveLength(1); expect(players).toHaveLength(1);
    expect(players[0].play).toHaveBeenCalledTimes(1);
    audio.setSuspended(true); expect(players[0].paused).toBe(true);
    audio.setSuspended(false); expect(players[0].paused).toBe(false);
    audio.configure({ ...DEFAULT_AUDIO, enabled: false }); expect(players[0].paused).toBe(true);
    audio.dispose(); expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(players[0].removeAttribute).toHaveBeenCalledWith('src');
  });
  it('does not load music when its independent volume is zero', async () => {
    const audio = new TrainingAudio();
    audio.configure({ ...DEFAULT_AUDIO, enabled: true, music: 0 });
    await audio.unlock(); expect(contexts).toHaveLength(1); expect(players).toHaveLength(0);
    audio.configure({ ...DEFAULT_AUDIO, enabled: true }); expect(players).toHaveLength(1);
    audio.configure({ ...DEFAULT_AUDIO, enabled: true, music: 0 }); expect(players[0].paused).toBe(true);
    audio.dispose();
  });
  it('does not revive media after a pending unlock resolves following unmount', async () => {
    const audio = new TrainingAudio();
    audio.configure({ ...DEFAULT_AUDIO, enabled: true });
    const pending = audio.unlock(); audio.dispose();
    expect(await pending).toBe(false); expect(players).toHaveLength(0);
  });
  it('handles browser audio failures without throwing into the game', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const error = vi.fn(); const audio = new TrainingAudio(error);
    expect(await audio.unlock()).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not start'));
    expect(() => audio.play({ kind: 'block' })).not.toThrow(); audio.dispose();
  });
});

describe('audio preferences', () => {
  it('defaults to explicit opt-in and validates stored levels', () => {
    expect(readAudioPreferences()).toEqual(DEFAULT_AUDIO);
    localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ enabled: 'yes', music: 2, effects: -1 }));
    expect(readAudioPreferences()).toEqual({ enabled: false, music: 1, effects: 0 });
    localStorage.setItem(AUDIO_PREFERENCES_KEY, '{broken');
    expect(readAudioPreferences()).toEqual(DEFAULT_AUDIO);
  });
});
