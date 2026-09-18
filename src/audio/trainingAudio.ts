import type { CreatureElement } from '../game/types.js';

export type SoundKind = 'draw' | 'deal' | 'place' | 'discard' | 'rotate' | 'attack' | 'damage' | 'block' | 'heal' | 'effect' | 'turn' | 'victory' | 'defeat';
export interface TrainingSound { kind: SoundKind; element?: CreatureElement; amount?: number; delay?: number }
export interface SoundPresentation { play: (sound: TrainingSound) => void; stopEffects: () => void }
export interface AudioPreferences { enabled: boolean; music: number; effects: number }
export const AUDIO_PREFERENCES_KEY = 'wisdom-duel.audio.v1';
export const DEFAULT_AUDIO: AudioPreferences = { enabled: false, music: 0.38, effects: 0.7 };
export const CONFLUENCE_MUSIC = '/audio/confluence-duel-v1.mp3';

export function readAudioPreferences(): AudioPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? 'null');
    const level = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
    return { enabled: value?.enabled === true, music: level(value?.music, DEFAULT_AUDIO.music), effects: level(value?.effects, DEFAULT_AUDIO.effects) };
  } catch { return { ...DEFAULT_AUDIO }; }
}

/** Original, layered material/element sounds. This renderer also works in OfflineAudioContext for audio QA. */
export function synthesizeSound(context: BaseAudioContext, destination: AudioNode, noise: AudioBuffer, cue: TrainingSound, start: number) {
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const variation = 0.96 + Math.random() * 0.08;
  const strength = Math.min(1.35, 0.85 + Math.max(0, cue.amount ?? 1) * 0.055);
  function envelope(duration: number, volume: number, offset: number, attack = 0.008) {
    const gain = context.createGain(); nodes.push(gain);
    const t = start + offset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    gain.gain.setValueAtTime(0, t + duration + 0.01);
    gain.connect(destination);
    return gain;
  }
  function tone(frequency: number, end: number, duration: number, volume: number, offset = 0, type: OscillatorType = 'sine') {
    const osc = context.createOscillator(); nodes.push(osc); sources.push(osc);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency * variation, start + offset);
    osc.frequency.exponentialRampToValueAtTime(end * variation, start + offset + duration);
    osc.connect(envelope(duration, volume, offset));
    osc.start(start + offset); osc.stop(start + offset + duration + 0.015);
  }
  function air(frequency: number, end: number, duration: number, volume: number, offset = 0, q = 0.7, type: BiquadFilterType = 'bandpass') {
    const source = context.createBufferSource(); nodes.push(source); sources.push(source);
    source.buffer = noise; source.loop = true;
    const filter = context.createBiquadFilter(); nodes.push(filter);
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, start + offset);
    filter.frequency.exponentialRampToValueAtTime(end, start + offset + duration);
    source.connect(filter); filter.connect(envelope(duration, volume, offset, Math.min(0.04, duration / 4)));
    source.start(start + offset, Math.random() * 0.5); source.stop(start + offset + duration + 0.015);
  }
  function element(offset = 0) {
    switch (cue.element) {
      case 'water': air(1500, 240, 0.62, 0.16, offset, 2.8); tone(480, 160, 0.32, 0.08, offset + 0.05); break;
      case 'earth': air(210, 65, 0.55, 0.28, offset, 0.8, 'lowpass'); tone(110, 48, 0.48, 0.17, offset); break;
      case 'air': air(700, 2300, 0.55, 0.12, offset); tone(880, 1174.66, 0.55, 0.045, offset + 0.06); break;
      case 'fire': air(2400, 480, 0.48, 0.2, offset, 0.8); air(3800, 600, 0.16, 0.12, offset + 0.08); tone(130, 50, 0.3, 0.09, offset); break;
      default: [293.66, 440, 587.33].forEach((f, i) => tone(f, f, 0.65, 0.055, offset + i * 0.055));
    }
  }
  switch (cue.kind) {
    case 'draw': air(1500, 650, 0.23, 0.21); air(3000, 1700, 0.12, 0.07, 0.09); tone(587, 660, 0.25, 0.035, 0.13); break;
    case 'deal': air(2100, 900, 0.16, 0.09); break;
    case 'place': air(650, 140, 0.22, 0.28); tone(155, 68, 0.28, 0.22); element(0.03); break;
    case 'discard': air(1600, 350, 0.32, 0.15); tone(220, 110, 0.24, 0.045); break;
    case 'rotate': air(1100, 450, 0.18, 0.09); [370, 745, 1110].forEach((f, i) => tone(f, f * 0.99, 0.38 - i * 0.07, 0.08 / (i + 1), 0.04)); break;
    case 'attack': air(330, 2100, 0.42, 0.18, 0, 1.4); tone(75, 150, 0.3, 0.1); break;
    case 'damage': tone(150, 42, 0.5, 0.34 * strength); tone(340, 90, 0.19, 0.1 * strength, 0, 'triangle'); air(1600, 180, 0.48, 0.32 * strength); air(3200, 700, 0.12, 0.13); break;
    case 'block': air(2700, 850, 0.18, 0.23); [392, 813, 1342, 2110].forEach((f, i) => tone(f, f * 0.98, 0.75 - i * 0.1, 0.15 / (i + 1))); tone(180, 140, 0.28, 0.14); break;
    case 'heal': [293.66, 369.99, 440, 587.33].forEach((f, i) => tone(f, f, 0.7, 0.085, i * 0.09)); air(600, 1800, 0.6, 0.04); break;
    case 'effect': element(); [293.66, 440].forEach((f, i) => tone(f, f * 2, 0.45, 0.05, i * 0.08)); break;
    case 'turn': tone(293.66, 293.66, 0.5, 0.09); tone(440, 440, 0.65, 0.075, 0.13); break;
    case 'victory': [293.66, 369.99, 440, 587.33].forEach((f, i) => { tone(f, f, 1.6, 0.11, i * 0.13, 'triangle'); tone(f / 2, f / 2, 1.8, 0.05, i * 0.13); }); break;
    case 'defeat': [293.66, 261.63, 220, 146.83].forEach((f, i) => tone(f, f, 1.3, 0.09, i * 0.19, 'triangle')); break;
  }
  const finished = Promise.all(sources.map(source => new Promise<void>(resolve => { source.onended = () => resolve(); })));
  void finished.then(() => nodes.forEach(node => node.disconnect()));
  return sources;
}

export function createNoise(context: BaseAudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** One lazy audio graph per match. No game rules or clocks depend on playback. */
export class TrainingAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private noise?: AudioBuffer;
  private music?: HTMLAudioElement;
  private active = new Set<AudioScheduledSourceNode>();
  private recent = new Map<SoundKind, number>();
  private settings: AudioPreferences = { ...DEFAULT_AUDIO };
  private suspended = false;
  private disposed = false;
  private revision = 0;
  private duckUntil = 0;
  constructor(private readonly onError: (message: string) => void = () => {}) {}

  async unlock() {
    if (this.disposed) return false;
    if (this.context?.state === 'running') return true;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) throw new Error('unsupported');
        const context = new Constructor(); this.context = context;
        this.master = context.createGain(); this.master.gain.value = 0;
        this.musicGain = context.createGain(); this.effectsGain = context.createGain();
        this.noise = createNoise(context);
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -9; limiter.knee.value = 12; limiter.ratio.value = 5;
        limiter.attack.value = 0.004; limiter.release.value = 0.18;
        this.musicGain.connect(this.master); this.effectsGain.connect(this.master);
        this.master.connect(limiter); limiter.connect(context.destination);
      }
      await this.context.resume();
      if (this.disposed) return false;
      this.applyGains();
      this.syncMusic();
      return true;
    } catch { if (!this.disposed) this.onError('Sound could not start. Try enabling it again.'); return false; }
  }

  configure(settings: AudioPreferences) {
    this.settings = settings; this.revision++;
    if (!settings.enabled || !settings.effects) this.stopEffects();
    this.applyGains(); this.syncMusic();
  }
  private applyGains() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setTargetAtTime(this.settings.enabled && !this.suspended ? 0.8 : 0, t, 0.015);
    this.effectsGain!.gain.setTargetAtTime(this.settings.effects, t, 0.02);
    this.musicGain!.gain.cancelScheduledValues(t);
    this.musicGain!.gain.setTargetAtTime(this.settings.music, t, 0.15);
    this.duckUntil = 0;
  }
  private syncMusic() {
    if (!this.context || this.disposed) return;
    if (!this.settings.enabled || !this.settings.music || this.suspended || this.context.state !== 'running') { this.music?.pause(); return; }
    if (!this.music) {
      this.music = new Audio(CONFLUENCE_MUSIC); this.music.preload = 'none'; this.music.loop = true;
      this.music.onerror = () => { if (!this.disposed) this.onError('Music is unavailable. Card effects are still ready.'); };
      this.context.createMediaElementSource(this.music).connect(this.musicGain!);
    }
    if (!this.music.paused) return;
    const revision = this.revision;
    void this.music.play().catch(error => {
      if (!this.disposed && revision === this.revision && (error as DOMException).name !== 'AbortError') this.onError('Music could not start. Toggle sound to try again.');
    });
  }
  setSuspended(suspended: boolean) {
    this.suspended = suspended; this.revision++;
    if (suspended) this.stopEffects();
    this.applyGains(); this.syncMusic();
  }
  play = (cue: TrainingSound) => {
    const context = this.context;
    if (this.disposed || this.suspended || !this.settings.enabled || !this.settings.effects || context?.state !== 'running') return;
    const now = context.currentTime;
    // Simultaneous moves/rotations share one audible beat; impacts keep priority.
    if (now - (this.recent.get(cue.kind) ?? -10) < 0.065) return;
    if (this.active.size > 60 && !['damage', 'block', 'victory', 'defeat'].includes(cue.kind)) return;
    this.recent.set(cue.kind, now);
    const sources = synthesizeSound(context, this.effectsGain!, this.noise!, cue, now + (cue.delay ?? 0));
    sources.forEach(source => {
      this.active.add(source);
      source.addEventListener('ended', () => this.active.delete(source), { once: true });
    });
    if (['damage', 'block', 'effect', 'victory', 'defeat'].includes(cue.kind)) {
      const gain = this.musicGain!.gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.settings.music * 0.48, now, 0.035);
      this.duckUntil = Math.max(this.duckUntil, now + 0.65 + (cue.delay ?? 0));
      gain.setTargetAtTime(this.settings.music, this.duckUntil, 0.4);
    }
  };
  stopEffects = () => {
    this.active.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
    this.active.clear(); this.recent.clear();
  };
  dispose() {
    this.disposed = true; this.revision++; this.stopEffects();
    if (this.music) { this.music.pause(); this.music.onerror = null; this.music.removeAttribute('src'); this.music.load(); }
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}
